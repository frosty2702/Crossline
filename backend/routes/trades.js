const express = require('express');
const { param, query, validationResult } = require('express-validator');
const Match = require('../models/Match');
const Order = require('../models/Order');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/trades/:userAddress - Get user's trade history
router.get('/:userAddress',
  param('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be >= 1'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userAddress } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      const page = parseInt(req.query.page) || 1;
      const skip = (page - 1) * limit;

      // Get user's executed trades
      const trades = await Match.find({
        $or: [
          { buyerAddress: userAddress.toLowerCase() },
          { sellerAddress: userAddress.toLowerCase() }
        ],
        matchStatus: 'executed'
      })
      .populate({
        path: 'buyOrderId sellOrderId',
        select: 'sellToken buyToken sellAmount buyAmount tokenPair sourceChain targetChain'
      })
      .sort({ executedAt: -1 })
      .skip(skip)
      .limit(limit);

      const total = await Match.countDocuments({
        $or: [
          { buyerAddress: userAddress.toLowerCase() },
          { sellerAddress: userAddress.toLowerCase() }
        ],
        matchStatus: 'executed'
      });

      // Format trades for response
      const formattedTrades = trades.map(trade => ({
        id: trade._id,
        tokenPair: trade.tokenPair,
        side: trade.buyerAddress === userAddress.toLowerCase() ? 'buy' : 'sell',
        price: trade.matchedPrice,
        amount: trade.matchedAmount,
        value: trade.buyAmount,
        executedAt: trade.executedAt,
        txHash: trade.executionTxHash,
        chain: trade.executionChain,
        fees: trade.fees,
        crossChain: trade.crossChainDetails ? {
          sourceChain: trade.crossChainDetails.sourceChain,
          targetChain: trade.crossChainDetails.targetChain,
          bridgeStatus: trade.crossChainDetails.bridgeStatus
        } : null
      }));

      res.json({
        success: true,
        data: {
          trades: formattedTrades,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching user trades:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// GET /api/trades/pair/:tokenPair - Get trade history for token pair
router.get('/pair/:tokenPair',
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

      const trades = await Match.find({
        tokenPair,
        matchStatus: 'executed'
      })
      .sort({ executedAt: -1 })
      .limit(limit)
      .select('matchedPrice matchedAmount buyAmount executedAt executionTxHash executionChain');

      res.json({
        success: true,
        data: {
          tokenPair,
          trades,
          count: trades.length
        }
      });

    } catch (error) {
      logger.error('Error fetching pair trades:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// GET /api/trades/stats/:userAddress - Get user trading statistics
router.get('/stats/:userAddress',
  param('userAddress').isEthereumAddress().withMessage('Invalid Ethereum address'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userAddress } = req.params;
      const address = userAddress.toLowerCase();

      // Aggregate user statistics
      const [tradeStats, orderStats] = await Promise.all([
        // Trade statistics
        Match.aggregate([
          {
            $match: {
              $or: [{ buyerAddress: address }, { sellerAddress: address }],
              matchStatus: 'executed'
            }
          },
          {
            $group: {
              _id: null,
              totalTrades: { $sum: 1 },
              totalVolume: { $sum: { $toDouble: '$buyAmount' } },
              avgTradeSize: { $avg: { $toDouble: '$matchedAmount' } },
              totalFeesPaid: { 
                $sum: { 
                  $add: [
                    { $toDouble: '$fees.relayerFee' },
                    { $toDouble: '$fees.protocolFee' },
                    { $toDouble: '$fees.gasFee' }
                  ]
                }
              }
            }
          }
        ]),

        // Order statistics
        Order.aggregate([
          {
            $match: { userAddress: address }
          },
          {
            $group: {
              _id: '$orderStatus',
              count: { $sum: 1 }
            }
          }
        ])
      ]);

      const stats = tradeStats[0] || {
        totalTrades: 0,
        totalVolume: 0,
        avgTradeSize: 0,
        totalFeesPaid: 0
      };

      const orderStatusCounts = {};
      orderStats.forEach(stat => {
        orderStatusCounts[stat._id] = stat.count;
      });

      // Calculate success rate
      const totalOrders = Object.values(orderStatusCounts).reduce((sum, count) => sum + count, 0);
      const successfulOrders = (orderStatusCounts.filled || 0) + (orderStatusCounts.partially_filled || 0);
      const successRate = totalOrders > 0 ? (successfulOrders / totalOrders) * 100 : 0;

      res.json({
        success: true,
        data: {
          userAddress,
          trading: {
            totalTrades: stats.totalTrades,
            totalVolume: stats.totalVolume.toString(),
            avgTradeSize: stats.avgTradeSize ? stats.avgTradeSize.toString() : '0',
            totalFeesPaid: stats.totalFeesPaid.toString()
          },
          orders: {
            total: totalOrders,
            ...orderStatusCounts,
            successRate: parseFloat(successRate.toFixed(2))
          }
        }
      });

    } catch (error) {
      logger.error('Error fetching user stats:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// GET /api/trades/match/:matchId - Get specific match details
router.get('/match/:matchId',
  param('matchId').isMongoId().withMessage('Invalid match ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const match = await Match.findById(req.params.matchId)
        .populate({
          path: 'buyOrderId sellOrderId',
          select: 'userAddress sellToken buyToken sellAmount buyAmount sourceChain targetChain signature createdAt'
        });

      if (!match) {
        return res.status(404).json({
          success: false,
          error: 'Match not found'
        });
      }

      res.json({
        success: true,
        data: match
      });

    } catch (error) {
      logger.error('Error fetching match details:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

module.exports = router; 