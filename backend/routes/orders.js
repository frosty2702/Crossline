const express = require('express');
const router = express.Router();
const { ethers } = require('ethers');
const Joi = require('joi');

// Models
const Order = require('../models/Order');
const User = require('../models/User');

// Config and utilities
const { getEIP712Domain, ORDER_TYPES, isValidChain } = require('../config/blockchain');

// Validation schemas
const orderSubmissionSchema = Joi.object({
  userAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  sellToken: Joi.object({
    address: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    symbol: Joi.string().required(),
    decimals: Joi.number().integer().min(0).max(18).required()
  }).required(),
  buyToken: Joi.object({
    address: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
    symbol: Joi.string().required(),
    decimals: Joi.number().integer().min(0).max(18).required()
  }).required(),
  sellAmount: Joi.string().pattern(/^[0-9]+$/).required(),
  buyAmount: Joi.string().pattern(/^[0-9]+$/).required(),
  sourceChain: Joi.number().integer().valid(1, 137, 42161, 31337).required(),
  targetChain: Joi.number().integer().valid(1, 137, 42161, 31337).required(),
  expiryTime: Joi.number().integer().min(Date.now()).required(),
  allowPartialFill: Joi.boolean().default(true),
  minFillAmount: Joi.string().pattern(/^[0-9]+$/).default('0'),
  nonce: Joi.string().required(),
  signature: Joi.object({
    v: Joi.number().integer().required(),
    r: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required(),
    s: Joi.string().pattern(/^0x[a-fA-F0-9]{64}$/).required()
  }).required()
});

// Utility functions
const generateOrderId = () => {
  return ethers.id(Date.now().toString() + Math.random().toString()).slice(0, 42);
};

const calculatePrice = (sellAmount, sellDecimals, buyAmount, buyDecimals) => {
  const sellAmountNormalized = Number(sellAmount) / Math.pow(10, sellDecimals);
  const buyAmountNormalized = Number(buyAmount) / Math.pow(10, buyDecimals);
  return buyAmountNormalized / sellAmountNormalized;
};

const verifyOrderSignature = async (orderData) => {
  try {
    const domain = getEIP712Domain(orderData.sourceChain);
    
    const message = {
      userAddress: orderData.userAddress,
      sellToken: orderData.sellToken.address,
      buyToken: orderData.buyToken.address,
      sellAmount: orderData.sellAmount,
      buyAmount: orderData.buyAmount,
      sourceChain: orderData.sourceChain,
      targetChain: orderData.targetChain,
      expiryTime: orderData.expiryTime,
      nonce: orderData.nonce
    };

    const recoveredAddress = ethers.verifyTypedData(
      domain,
      ORDER_TYPES,
      message,
      orderData.signature
    );

    return recoveredAddress.toLowerCase() === orderData.userAddress.toLowerCase();
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
};

// Routes

/**
 * POST /api/orders
 * Submit a new limit order
 */
router.post('/', async (req, res) => {
  try {
    // Validate request body
    const { error, value } = orderSubmissionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation Error',
        details: error.details.map(d => d.message)
      });
    }

    const orderData = value;

    // Verify signature
    const isValidSignature = await verifyOrderSignature(orderData);
    if (!isValidSignature) {
      return res.status(400).json({
        error: 'Invalid Signature',
        message: 'Order signature verification failed'
      });
    }

    // Generate order ID
    const orderId = generateOrderId();

    // Calculate price
    const price = calculatePrice(
      orderData.sellAmount,
      orderData.sellToken.decimals,
      orderData.buyAmount,
      orderData.buyToken.decimals
    );

    // Create order
    const order = new Order({
      orderId,
      userAddress: orderData.userAddress.toLowerCase(),
      sellToken: orderData.sellToken,
      buyToken: orderData.buyToken,
      sellAmount: orderData.sellAmount,
      buyAmount: orderData.buyAmount,
      price,
      sourceChain: orderData.sourceChain,
      targetChain: orderData.targetChain,
      expiryTime: new Date(orderData.expiryTime),
      remainingAmount: orderData.sellAmount,
      signature: orderData.signature,
      nonce: orderData.nonce,
      allowPartialFill: orderData.allowPartialFill,
      minFillAmount: orderData.minFillAmount
    });

    await order.save();

    // Update user stats
    let user = await User.findOne({ address: orderData.userAddress.toLowerCase() });
    if (!user) {
      user = new User({ address: orderData.userAddress.toLowerCase() });
    }
    user.stats.totalOrders += 1;
    await user.save();

    // Emit real-time update
    const io = req.app.get('io');
    const tokenPair = `${orderData.sellToken.symbol}_${orderData.buyToken.symbol}`;
    io.to(`orderbook_${tokenPair}`).emit('new_order', {
      orderId,
      price,
      amount: orderData.sellAmount,
      side: 'sell',
      tokenPair
    });

    io.to(`user_${orderData.userAddress.toLowerCase()}`).emit('order_created', {
      orderId,
      status: 'open'
    });

    res.status(201).json({
      success: true,
      orderId,
      message: 'Order submitted successfully',
      order: {
        orderId,
        price,
        tokenPair,
        amount: orderData.sellAmount,
        status: 'open',
        expiryTime: orderData.expiryTime
      }
    });

  } catch (error) {
    console.error('Order submission error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        error: 'Duplicate Order',
        message: 'Order with this ID already exists'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to submit order'
    });
  }
});

/**
 * GET /api/orders
 * Get orders with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const {
      userAddress,
      tokenPair,
      status,
      sourceChain,
      targetChain,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};
    
    if (userAddress) {
      query.userAddress = userAddress.toLowerCase();
    }
    
    if (tokenPair) {
      const [sellSymbol, buySymbol] = tokenPair.split('_');
      query['sellToken.symbol'] = sellSymbol;
      query['buyToken.symbol'] = buySymbol;
    }
    
    if (status) {
      query.orderStatus = status;
    }
    
    if (sourceChain) {
      query.sourceChain = parseInt(sourceChain);
    }
    
    if (targetChain) {
      query.targetChain = parseInt(targetChain);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [orders, totalCount] = await Promise.all([
      Order.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-signature -executionHistory'),
      Order.countDocuments(query)
    ]);

    res.json({
      success: true,
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalOrders: totalCount,
        hasNextPage: skip + orders.length < totalCount,
        hasPrevPage: parseInt(page) > 1
      }
    });

  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve orders'
    });
  }
});

/**
 * GET /api/orders/:orderId
 * Get specific order details
 */
router.get('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findOne({ orderId })
      .select('-signature'); // Don't expose signature

    if (!order) {
      return res.status(404).json({
        error: 'Order Not Found',
        message: 'Order with this ID does not exist'
      });
    }

    res.json({
      success: true,
      order
    });

  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve order'
    });
  }
});

/**
 * DELETE /api/orders/:orderId
 * Cancel an order
 */
router.delete('/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userAddress, signature } = req.body;

    if (!userAddress || !signature) {
      return res.status(400).json({
        error: 'Missing Parameters',
        message: 'userAddress and signature are required'
      });
    }

    const order = await Order.findOne({ orderId });

    if (!order) {
      return res.status(404).json({
        error: 'Order Not Found',
        message: 'Order with this ID does not exist'
      });
    }

    // Verify ownership
    if (order.userAddress !== userAddress.toLowerCase()) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You can only cancel your own orders'
      });
    }

    // Check if order can be cancelled
    if (!['open', 'partially_filled'].includes(order.orderStatus)) {
      return res.status(400).json({
        error: 'Invalid Status',
        message: 'Order cannot be cancelled in current status'
      });
    }

    // Update order status
    order.orderStatus = 'cancelled';
    order.updatedAt = new Date();
    await order.save();

    // Emit real-time update
    const io = req.app.get('io');
    const tokenPair = `${order.sellToken.symbol}_${order.buyToken.symbol}`;
    
    io.to(`orderbook_${tokenPair}`).emit('order_cancelled', {
      orderId,
      tokenPair
    });

    io.to(`user_${userAddress.toLowerCase()}`).emit('order_cancelled', {
      orderId,
      status: 'cancelled'
    });

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      orderId
    });

  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to cancel order'
    });
  }
});

module.exports = router; 