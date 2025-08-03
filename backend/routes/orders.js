const express = require('express');
const { body, param, validationResult } = require('express-validator');
const crypto = require('crypto');
const Order = require('../models/Order');
const { verifyOrderSignature, verifyCrossChainOrderSignature } = require('../services/signatureVerification');
const logger = require('../utils/logger');

const router = express.Router();

// Validation middleware
const validateOrderCreation = [
  body('maker').isEthereumAddress().withMessage('Invalid maker address'),
  body('sellToken').isEthereumAddress().withMessage('Invalid sell token address'),
  body('buyToken').isEthereumAddress().withMessage('Invalid buy token address'),
  body('sellAmount').matches(/^\d+$/).withMessage('sellAmount must be a positive integer string'),
  body('buyAmount').matches(/^\d+$/).withMessage('buyAmount must be a positive integer string'),
  body('expiry').isInt({ min: Math.floor(Date.now() / 1000) }).withMessage('Expiry must be in the future'),
  body('nonce').matches(/^\d+$/).withMessage('Invalid nonce'),
  body('chainId').isInt({ min: 1 }).withMessage('Invalid chain ID'),
  body('signature').isString().isLength({ min: 1 }).withMessage('Signature is required')
];

// GET /api/orders - Fetch orders with advanced filtering
router.get('/', async (req, res) => {
  try {
    const {
      maker,
      status = 'active',
      tokenPair,
      sellToken,
      buyToken,
      limit = 50,
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (maker) {
      query.maker = maker.toLowerCase();
    }
    
    if (status && status !== 'all') {
      query.status = status;
      if (status === 'active') {
        query.expiry = { $gt: new Date() };
      }
    }
    
    if (tokenPair) {
      query.tokenPair = tokenPair;
    }
    
    if (sellToken) {
      query.sellToken = sellToken.toLowerCase();
    }
    
    if (buyToken) {
      query.buyToken = buyToken.toLowerCase();
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(skip)
        .lean(),
      Order.countDocuments(query)
    ]);

    logger.info(`📋 Fetched ${orders.length} orders (${total} total) for query:`, query);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });

  } catch (error) {
    logger.error('❌ Error fetching orders:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// POST /api/orders - Create new order (Production version)
router.post('/', validateOrderCreation, async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const orderData = req.body;
    logger.info('📝 Processing order creation request from:', orderData.maker);
    logger.info('🔍 Received signature:', orderData.signature);
    logger.info('🔍 Signature type:', typeof orderData.signature);
    logger.info('🔍 Signature length:', orderData.signature?.length);
    logger.info('🔍 Full order data:', JSON.stringify(orderData, null, 2));

    // Generate order hash
    const orderHashData = `${orderData.maker}-${orderData.sellToken}-${orderData.buyToken}-${orderData.sellAmount}-${orderData.buyAmount}-${orderData.nonce}-${orderData.expiry}`;
    const orderHash = '0x' + crypto.createHash('sha256').update(orderHashData).digest('hex');

    // TODO: For production deployment, ensure NODE_ENV=production to enable signature verification
    // Verify signature (bypass in development for demo purposes)
    if (process.env.NODE_ENV === 'production') {
      const isValidSignature = await verifyOrderSignature(orderData, orderData.signature);
      if (!isValidSignature) {
        logger.warn('❌ Invalid signature for order from:', orderData.maker);
        return res.status(400).json({
          success: false,
          error: 'Invalid order signature'
        });
      }
    } else {
      logger.info('⚠️ Signature verification bypassed in development mode');
    }

    // Check for duplicate order hash
    const existingOrder = await Order.findOne({ orderHash });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        error: 'Order already exists'
      });
    }

    // Check for duplicate nonce from same maker
    const duplicateNonce = await Order.findOne({
      maker: orderData.maker.toLowerCase(),
      nonce: orderData.nonce
    });
    if (duplicateNonce) {
      return res.status(400).json({
        success: false,
        error: 'Nonce already used by this maker'
      });
    }

    // Calculate price
    const price = parseFloat(orderData.buyAmount) / parseFloat(orderData.sellAmount);

    // Create order
    const order = new Order({
      maker: orderData.maker.toLowerCase(),
      sellToken: orderData.sellToken.toLowerCase(),
      buyToken: orderData.buyToken.toLowerCase(),
      sellAmount: orderData.sellAmount,
      buyAmount: orderData.buyAmount,
      nonce: orderData.nonce,
      expiry: new Date(orderData.expiry * 1000), // Convert from Unix timestamp
      chainId: orderData.chainId,
      signature: orderData.signature,
      orderHash,
      price,
      sourceChain: orderData.sourceChain || 'ethereum',
      targetChain: orderData.targetChain || 'ethereum',
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        version: '1.0',
        referrer: req.get('Referer')
      }
    });

    await order.save();

    logger.info(`✅ Order created successfully: ${order._id} for ${order.maker}`);

    // Emit to real-time subscribers
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('new-order', {
          type: 'new-order',
          data: order
        });
        io.to(`orderbook:${order.tokenPair}`).emit('orderbook-update', {
          type: 'new-order',
          data: order
        });
      }
    } catch (ioError) {
      logger.warn('⚠️ Socket.io emit failed:', ioError.message);
    }

    res.status(201).json({
      success: true,
      data: {
        orderId: order._id,
        orderHash: order.orderHash,
        order: order.toObject()
      }
    });

  } catch (error) {
    logger.error('❌ Error creating order:', error);
    
    // Handle specific MongoDB errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Duplicate order or nonce'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/orders/:orderId - Get specific order
router.get('/:orderId',
  param('orderId').isMongoId().withMessage('Invalid order ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const order = await Order.findById(req.params.orderId);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      res.json({
        success: true,
        data: { order }
      });

    } catch (error) {
      logger.error('Error fetching order:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// POST /api/orders/:orderId/cancel - Cancel order
router.post('/:orderId/cancel',
  param('orderId').isMongoId().withMessage('Invalid order ID'),
  body('maker').isEthereumAddress().withMessage('Invalid maker address'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const order = await Order.findById(req.params.orderId);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      // Verify maker
      if (order.maker.toLowerCase() !== req.body.maker.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Only order maker can cancel'
        });
      }

      // Check if order can be cancelled
      if (order.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: `Cannot cancel order with status: ${order.status}`
        });
      }

      await order.cancel();

      logger.info(`🚫 Order cancelled: ${order._id} by ${order.maker}`);

      // Emit cancellation event
      try {
        const io = req.app.get('io');
        if (io) {
          io.emit('order-cancelled', {
            type: 'order-cancelled',
            data: { orderId: order._id, orderHash: order.orderHash }
          });
        }
      } catch (ioError) {
        logger.warn('⚠️ Socket.io emit failed:', ioError.message);
      }

      res.json({
        success: true,
        data: {
          message: 'Order cancelled successfully',
          order: order.toObject()
        }
      });

    } catch (error) {
      logger.error('Error cancelling order:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// GET /api/orders/maker/:address - Get orders by maker
router.get('/maker/:address',
  param('address').isEthereumAddress().withMessage('Invalid address'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { status, limit = 50, page = 1 } = req.query;
      const address = req.params.address.toLowerCase();

      const orders = await Order.findByMaker(address, status)
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await Order.countDocuments({
        maker: address,
        ...(status && { status })
      });

      res.json({
        success: true,
        data: {
          orders,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching maker orders:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
);

// Cross-chain order creation endpoint
router.post('/crosschain', validateOrderCreation, async (req, res) => {
  try {
    const orderData = req.body;
    logger.info('📝 Processing cross-chain order creation request from:', orderData.maker);
    logger.info('🌐 Cross-chain order: Source Chain', orderData.chainId, '→ Target Chain', orderData.targetChain);
    
    // Validate cross-chain specific fields
    if (!orderData.targetChain) {
      return res.status(400).json({
        success: false,
        message: 'Target chain is required for cross-chain orders'
      });
    }

    // Verify signature using the source chain's contract
    const isValidSignature = await verifyCrossChainOrderSignature(orderData, orderData.signature);
    if (!isValidSignature) {
      logger.warn('❌ Invalid signature for cross-chain order from:', orderData.maker);
      return res.status(400).json({
        success: false,
        message: 'Invalid signature'
      });
    }

    logger.info('✅ Cross-chain signature verified for order from', orderData.maker);

    // Calculate price (required field)
    const price = parseFloat(orderData.buyAmount) / parseFloat(orderData.sellAmount);

    // Generate order hash (required field)
    const orderHashData = `${orderData.maker}-${orderData.sellToken}-${orderData.buyToken}-${orderData.sellAmount}-${orderData.buyAmount}-${orderData.nonce}-${orderData.expiry}`;
    const orderHash = '0x' + crypto.createHash('sha256').update(orderHashData).digest('hex');

    // Check for duplicate nonce
    const existingOrder = await Order.findOne({
      maker: orderData.maker.toLowerCase(),
      nonce: orderData.nonce,
      status: { $ne: 'cancelled' }
    });

    if (existingOrder) {
      return res.status(400).json({
        success: false,
        error: 'Nonce already used by this maker'
      });
    }

    // Debug: Log the order data being used for creation
    logger.info('🔍 Creating cross-chain order with data:', JSON.stringify({
      maker: orderData.maker,
      sellToken: orderData.sellToken,
      buyToken: orderData.buyToken,
      sellAmount: orderData.sellAmount,
      buyAmount: orderData.buyAmount,
      nonce: orderData.nonce,
      expiry: orderData.expiry,
      chainId: orderData.chainId,
      targetChain: orderData.targetChain,
      crossChain: true,
      sourceChain: orderData.chainId,
      status: 'active',
      price: price,
      orderHash: orderHash
    }, null, 2));

    // Create cross-chain order in database
    const crossChainOrder = new Order({
      maker: orderData.maker.toLowerCase(),
      sellToken: orderData.sellToken.toLowerCase(),
      buyToken: orderData.buyToken.toLowerCase(),
      sellAmount: orderData.sellAmount,
      buyAmount: orderData.buyAmount,
      nonce: orderData.nonce,
      expiry: new Date(orderData.expiry * 1000), // Convert from Unix timestamp
      chainId: orderData.chainId,
      signature: orderData.signature,
      orderHash,
      price,
      crossChain: true,
      sourceChain: orderData.chainId,
      targetChain: orderData.targetChain,
      status: 'active',
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        version: '1.0',
        referrer: req.get('Referer')
      },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const savedOrder = await crossChainOrder.save();
    logger.info('✅ Cross-chain order created successfully:', savedOrder._id, 'for', orderData.maker.toLowerCase());

    // TODO: Initiate cross-chain message via CrossChainManager
    // This would trigger the actual cross-chain flow
    
    res.status(201).json({
      success: true,
      message: 'Cross-chain order created successfully',
      orderId: savedOrder._id,
      order: {
        id: savedOrder._id,
        maker: savedOrder.maker,
        sourceChain: savedOrder.sourceChain,
        targetChain: savedOrder.targetChain,
        sellToken: savedOrder.sellToken,
        buyToken: savedOrder.buyToken,
        sellAmount: savedOrder.sellAmount,
        buyAmount: savedOrder.buyAmount,
        status: savedOrder.status,
        crossChain: true,
        createdAt: savedOrder.createdAt
      }
    });

  } catch (error) {
    logger.error('❌ Cross-chain order creation failed:', error.message);
    logger.error('❌ Full error details:', error);
    logger.error('❌ Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Demo endpoint for hackathon - instantly process orders for presentation
router.post('/demo/process/:orderId', async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (order.status !== 'active') {
      return res.status(400).json({
        success: false,
        error: 'Order is not active'
      });
    }

    // Simulate order processing for demo
    logger.info(`🎭 DEMO: Processing order ${orderId} for hackathon demo`);
    
    // Update order status to show processing stages
    const stages = ['matching', 'executing', 'cross_chain_messaging', 'completed'];
    
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      
      // Update order status
      order.status = stage;
      order.updatedAt = new Date();
      
      if (stage === 'completed') {
        order.filledAmount = order.sellAmount;
        order.completedAt = new Date();
      }
      
      await order.save();
      
      // Emit real-time update
      const io = req.app.get('io');
      if (io) {
        io.emit('order-update', {
          type: 'status-change',
          orderId: order._id,
          status: stage,
          message: getDemoStageMessage(stage),
          timestamp: new Date()
        });
      }
      
      logger.info(`🎭 DEMO: Order ${orderId} → ${stage.toUpperCase()}`);
      
      // Wait between stages for dramatic effect
      if (i < stages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    res.json({
      success: true,
      message: 'Order processed successfully (DEMO MODE)',
      data: {
        orderId: order._id,
        finalStatus: 'completed',
        stages: stages
      }
    });

  } catch (error) {
    logger.error('❌ Demo processing failed:', error);
    res.status(500).json({
      success: false,
      error: 'Demo processing failed'
    });
  }
});

// Helper function for demo stage messages
function getDemoStageMessage(stage) {
  const messages = {
    'matching': '🔍 Finding compatible orders...',
    'executing': '⚡ Executing trade on source chain...',
    'cross_chain_messaging': '🌐 Processing via LayerZero/Axelar...',
    'completed': '✅ Cross-chain trade completed!'
  };
  return messages[stage] || 'Processing...';
}

module.exports = router; 