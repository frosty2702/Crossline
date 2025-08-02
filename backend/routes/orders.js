const express = require('express');
const { body, validationResult, param } = require('express-validator');
const Order = require('../models/Order');
const { verifySignature } = require('../services/signatureVerification');
const { validateOrder } = require('../middleware/validation');
const logger = require('../utils/logger');
const { db } = require('../config/database');

const router = express.Router();

// GET /api/orders - Fetch orders (Demo version)
router.get('/', async (req, res) => {
  try {
    const { maker, status } = req.query;
    
    // Get orders from in-memory storage
    const { db } = require('../config/database');
    let orders = Array.from(db.orders.values());
    
    // Apply filters if provided
    if (maker) {
      orders = orders.filter(order => order.maker.toLowerCase() === maker.toLowerCase());
    }
    if (status) {
      orders = orders.filter(order => order.status === status);
    }

    // Sort by creation date (newest first)
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log(`📋 Returning ${orders.length} orders (filtered from ${db.orders.size} total)`);

    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('❌ Error fetching orders:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/orders - Get user's orders
router.get('/:userAddress', 
  param('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userAddress } = req.params;
      const { status, limit = 50, page = 1 } = req.query;

      const query = { userAddress: userAddress.toLowerCase() };
      if (status) {
        query.orderStatus = status;
      }

      const orders = await Order.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip((parseInt(page) - 1) * parseInt(limit));

      const total = await Order.countDocuments(query);

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
      logger.error('Error fetching orders:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// POST /api/orders - Submit new order (Demo version)
router.post('/', async (req, res) => {
  try {
    console.log('📝 Received order creation request:', req.body);
    
    const orderData = req.body;
    
    // Basic validation
    if (!orderData.maker || !orderData.sellToken || !orderData.buyToken || !orderData.sellAmount || !orderData.buyAmount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required order fields' 
      });
    }

    // Create order ID
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create order object for in-memory storage
    const order = {
      id: orderId,
      maker: orderData.maker.toLowerCase(),
      sellToken: orderData.sellToken,
      buyToken: orderData.buyToken,
      sellAmount: orderData.sellAmount,
      buyAmount: orderData.buyAmount,
      expiry: orderData.expiry,
      nonce: orderData.nonce,
      chainId: orderData.chainId,
      status: 'active',
      createdAt: new Date().toISOString(),
      tokenPair: `${orderData.sellToken}/${orderData.buyToken}`
    };

    // Store in memory
    const { db } = require('../config/database');
    db.orders.set(orderId, order);
    
    console.log('✅ Order created successfully:', orderId);
    console.log('📊 Total orders in memory:', db.orders.size);

    // Emit to real-time subscribers (if io is available)
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('new-order', order);
      }
    } catch (ioError) {
      console.log('Socket.io not available, skipping real-time emit');
    }

    res.status(201).json({
      success: true,
      data: {
        order,
        message: 'Order created successfully'
      }
    });

  } catch (error) {
    console.error('❌ Error creating order:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      details: error.message 
    });
  }
});

// GET /api/orders/:orderId - Get specific order
router.get('/order/:orderId',
  param('orderId').isMongoId().withMessage('Invalid order ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
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
        data: order
      });

    } catch (error) {
      logger.error('Error fetching order:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// PUT /api/orders/:orderId/cancel - Cancel order
router.put('/:orderId/cancel',
  param('orderId').isMongoId().withMessage('Invalid order ID'),
  body('userAddress').isEthereumAddress().withMessage('Invalid user address'),
  body('signature').notEmpty().withMessage('Signature required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { orderId } = req.params;
      const { userAddress, signature } = req.body;

      // Find order
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ 
          success: false, 
          error: 'Order not found' 
        });
      }

      // Verify ownership
      if (order.userAddress !== userAddress.toLowerCase()) {
        return res.status(403).json({ 
          success: false, 
          error: 'Not authorized to cancel this order' 
        });
      }

      // Check if order can be cancelled
      if (!['open', 'partially_filled'].includes(order.orderStatus)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Order cannot be cancelled' 
        });
      }

      // Verify cancellation signature (optional additional security)
      // const isValidCancelSignature = await verifyCancellationSignature(orderId, userAddress, signature);
      // if (!isValidCancelSignature) {
      //   return res.status(400).json({ success: false, error: 'Invalid cancellation signature' });
      // }

      // Update order status
      order.orderStatus = 'cancelled';
      await order.save();

      // Emit to real-time subscribers
      const io = req.app.get('io');
      io.to(`orderbook:${order.tokenPair}`).emit('order-cancelled', {
        type: 'order-cancelled',
        data: { orderId: order._id }
      });

      logger.info(`Order cancelled: ${orderId} by ${userAddress}`);

      res.json({
        success: true,
        data: { 
          orderId,
          status: 'cancelled' 
        }
      });

    } catch (error) {
      logger.error('Error cancelling order:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

module.exports = router; 