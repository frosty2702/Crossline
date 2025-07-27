const express = require('express');
const router = express.Router();
const Order = require('../models/Order');

/**
 * GET /api/orderbook/:tokenPair
 * Get order book for a specific token pair
 */
router.get('/:tokenPair', async (req, res) => {
  try {
    const { tokenPair } = req.params;
    const { limit = 50, sourceChain, targetChain } = req.query;

    // Parse token pair (e.g., "USDC_ETH")
    const [sellSymbol, buySymbol] = tokenPair.split('_');
    
    if (!sellSymbol || !buySymbol) {
      return res.status(400).json({
        error: 'Invalid Token Pair',
        message: 'Token pair must be in format SELL_BUY (e.g., USDC_ETH)'
      });
    }

    // Build base query
    const baseQuery = {
      orderStatus: { $in: ['open', 'partially_filled'] },
      expiryTime: { $gt: new Date() }
    };

    if (sourceChain) baseQuery.sourceChain = parseInt(sourceChain);
    if (targetChain) baseQuery.targetChain = parseInt(targetChain);

    // Get sell orders (selling sellSymbol for buySymbol)
    const sellOrders = await Order.find({
      ...baseQuery,
      'sellToken.symbol': sellSymbol,
      'buyToken.symbol': buySymbol
    })
    .sort({ price: 1 }) // Lowest price first (best for buyers)
    .limit(parseInt(limit))
    .select('orderId price remainingAmount sellToken buyToken sourceChain targetChain createdAt userAddress');

    // Get buy orders (selling buySymbol for sellSymbol - essentially buying sellSymbol)
    const buyOrders = await Order.find({
      ...baseQuery,
      'sellToken.symbol': buySymbol,
      'buyToken.symbol': sellSymbol
    })
    .sort({ price: -1 }) // Highest price first (best for sellers)
    .limit(parseInt(limit))
    .select('orderId price remainingAmount sellToken buyToken sourceChain targetChain createdAt userAddress');

    // Format sell orders
    const formattedSellOrders = sellOrders.map(order => ({
      orderId: order.orderId,
      price: order.price,
      amount: order.remainingAmount,
      total: (parseFloat(order.remainingAmount) * order.price).toString(),
      side: 'sell',
      sourceChain: order.sourceChain,
      targetChain: order.targetChain,
      userAddress: order.userAddress,
      timestamp: order.createdAt
    }));

    // Format buy orders (need to invert price since they're selling the other token)
    const formattedBuyOrders = buyOrders.map(order => ({
      orderId: order.orderId,
      price: 1 / order.price, // Invert price
      amount: (parseFloat(order.remainingAmount) * order.price).toString(), // Convert to sellSymbol amount
      total: order.remainingAmount,
      side: 'buy',
      sourceChain: order.sourceChain,
      targetChain: order.targetChain,
      userAddress: order.userAddress,
      timestamp: order.createdAt
    }));

    // Calculate market stats
    const allRecentTrades = await Order.find({
      $or: [
        { 'sellToken.symbol': sellSymbol, 'buyToken.symbol': buySymbol },
        { 'sellToken.symbol': buySymbol, 'buyToken.symbol': sellSymbol }
      ],
      orderStatus: 'filled',
      updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).sort({ updatedAt: -1 });

    let lastPrice = null;
    let volume24h = 0;
    let priceChange24h = 0;

    if (allRecentTrades.length > 0) {
      const latestTrade = allRecentTrades[0];
      lastPrice = latestTrade.sellToken.symbol === sellSymbol ? 
        latestTrade.price : 1 / latestTrade.price;

      // Calculate 24h volume in sellSymbol
      volume24h = allRecentTrades.reduce((sum, trade) => {
        const amount = trade.sellToken.symbol === sellSymbol ? 
          parseFloat(trade.sellAmount) : parseFloat(trade.buyAmount);
        return sum + amount;
      }, 0);

      // Calculate price change
      if (allRecentTrades.length > 1) {
        const oldestTrade = allRecentTrades[allRecentTrades.length - 1];
        const oldPrice = oldestTrade.sellToken.symbol === sellSymbol ? 
          oldestTrade.price : 1 / oldestTrade.price;
        priceChange24h = ((lastPrice - oldPrice) / oldPrice) * 100;
      }
    }

    // Get spread
    const bestBid = formattedBuyOrders.length > 0 ? formattedBuyOrders[0].price : null;
    const bestAsk = formattedSellOrders.length > 0 ? formattedSellOrders[0].price : null;
    const spread = (bestBid && bestAsk) ? ((bestAsk - bestBid) / bestBid) * 100 : null;

    res.json({
      success: true,
      tokenPair,
      timestamp: new Date().toISOString(),
      orderbook: {
        bids: formattedBuyOrders, // Buy orders
        asks: formattedSellOrders  // Sell orders
      },
      market: {
        lastPrice,
        bestBid,
        bestAsk,
        spread: spread ? parseFloat(spread.toFixed(4)) : null,
        volume24h: volume24h.toString(),
        priceChange24h: parseFloat(priceChange24h.toFixed(2))
      },
      metadata: {
        totalBids: formattedBuyOrders.length,
        totalAsks: formattedSellOrders.length,
        chains: {
          source: sourceChain ? [parseInt(sourceChain)] : [1, 137, 42161],
          target: targetChain ? [parseInt(targetChain)] : [1, 137, 42161]
        }
      }
    });

  } catch (error) {
    console.error('Get orderbook error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve orderbook'
    });
  }
});

/**
 * GET /api/orderbook/pairs
 * Get all available trading pairs
 */
router.get('/', async (req, res) => {
  try {
    const pairs = await Order.aggregate([
      {
        $match: {
          orderStatus: { $in: ['open', 'partially_filled'] },
          expiryTime: { $gt: new Date() }
        }
      },
      {
        $group: {
          _id: {
            sellSymbol: '$sellToken.symbol',
            buySymbol: '$buyToken.symbol'
          },
          count: { $sum: 1 },
          lastActivity: { $max: '$createdAt' }
        }
      },
      {
        $project: {
          tokenPair: { $concat: ['$_id.sellSymbol', '_', '$_id.buySymbol'] },
          orderCount: '$count',
          lastActivity: '$lastActivity'
        }
      },
      {
        $sort: { orderCount: -1 }
      }
    ]);

    res.json({
      success: true,
      pairs: pairs.map(p => ({
        tokenPair: p.tokenPair,
        orderCount: p.orderCount,
        lastActivity: p.lastActivity
      }))
    });

  } catch (error) {
    console.error('Get trading pairs error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve trading pairs'
    });
  }
});

module.exports = router; 