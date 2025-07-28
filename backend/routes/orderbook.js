const express = require('express');
const { param, query, validationResult } = require('express-validator');
const Order = require('../models/Order');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/orderbook/:tokenPair - Get order book for token pair
router.get('/:tokenPair',
  param('tokenPair').matches(/^[A-Z]+-[A-Z]+$/).withMessage('Invalid token pair format (e.g., WETH-USDC)'),
  query('depth').optional().isInt({ min: 1, max: 100 }).withMessage('Depth must be between 1-100'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tokenPair } = req.params;
      const depth = parseInt(req.query.depth) || 20;

      // Get buy orders (highest price first)
      const buyOrders = await Order.find({
        tokenPair,
        orderType: 'buy',
        orderStatus: 'open',
        expiry: { $gt: new Date() }
      })
      .sort({ price: -1, createdAt: 1 }) // Price-time priority
      .limit(depth)
      .select('price sellAmount buyAmount userAddress createdAt');

      // Get sell orders (lowest price first)
      const sellOrders = await Order.find({
        tokenPair,
        orderType: 'sell',
        orderStatus: 'open',
        expiry: { $gt: new Date() }
      })
      .sort({ price: 1, createdAt: 1 }) // Price-time priority
      .limit(depth)
      .select('price sellAmount buyAmount userAddress createdAt');

      // Aggregate orders by price level
      const aggregateBuys = aggregateOrdersByPrice(buyOrders);
      const aggregateSells = aggregateOrdersByPrice(sellOrders);

      // Calculate spread
      const bestBid = aggregateBuys.length > 0 ? aggregateBuys[0].price : 0;
      const bestAsk = aggregateSells.length > 0 ? aggregateSells[0].price : 0;
      const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
      const spreadPercent = bestAsk > 0 && bestBid > 0 ? (spread / bestAsk) * 100 : 0;

      res.json({
        success: true,
        data: {
          tokenPair,
          timestamp: new Date(),
          bids: aggregateBuys, // Buy orders
          asks: aggregateSells, // Sell orders
          spread: {
            absolute: spread,
            percent: spreadPercent,
            bestBid,
            bestAsk
          },
          depth: {
            requested: depth,
            bids: buyOrders.length,
            asks: sellOrders.length
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching orderbook:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// GET /api/orderbook/pairs - Get all available trading pairs
router.get('/pairs', async (req, res) => {
  try {
    // Get distinct token pairs with open orders
    const pairs = await Order.distinct('tokenPair', {
      orderStatus: 'open',
      expiry: { $gt: new Date() }
    });

    // Get stats for each pair
    const pairStats = await Promise.all(
      pairs.map(async (pair) => {
        const [buyCount, sellCount] = await Promise.all([
          Order.countDocuments({
            tokenPair: pair,
            orderType: 'buy',
            orderStatus: 'open',
            expiry: { $gt: new Date() }
          }),
          Order.countDocuments({
            tokenPair: pair,
            orderType: 'sell',
            orderStatus: 'open',
            expiry: { $gt: new Date() }
          })
        ]);

        return {
          pair,
          buyOrders: buyCount,
          sellOrders: sellCount,
          totalOrders: buyCount + sellCount
        };
      })
    );

    res.json({
      success: true,
      data: {
        pairs: pairStats.filter(p => p.totalOrders > 0),
        total: pairStats.length
      }
    });

  } catch (error) {
    logger.error('Error fetching trading pairs:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/orderbook/:tokenPair/history - Get recent trade history
router.get('/:tokenPair/history',
  param('tokenPair').matches(/^[A-Z]+-[A-Z]+$/).withMessage('Invalid token pair format'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { tokenPair } = req.params;
      const limit = parseInt(req.query.limit) || 50;

      // Get recent filled orders (executed trades)
      const recentTrades = await Order.find({
        tokenPair,
        orderStatus: { $in: ['filled', 'partially_filled'] },
        executedAt: { $ne: null }
      })
      .sort({ executedAt: -1 })
      .limit(limit)
      .select('price sellAmount buyAmount orderType executedAt executionTxHash');

      res.json({
        success: true,
        data: {
          tokenPair,
          trades: recentTrades,
          count: recentTrades.length
        }
      });

    } catch (error) {
      logger.error('Error fetching trade history:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// Helper function to aggregate orders by price level
function aggregateOrdersByPrice(orders) {
  const priceMap = new Map();

  orders.forEach(order => {
    const price = order.price;
    if (priceMap.has(price)) {
      const existing = priceMap.get(price);
      existing.totalAmount = (parseFloat(existing.totalAmount) + parseFloat(order.sellAmount)).toString();
      existing.orderCount += 1;
    } else {
      priceMap.set(price, {
        price,
        totalAmount: order.sellAmount,
        orderCount: 1,
        orders: [order._id]
      });
    }
  });

  return Array.from(priceMap.values()).sort((a, b) => b.price - a.price);
}

module.exports = router; 