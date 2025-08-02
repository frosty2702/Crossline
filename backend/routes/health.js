const express = require('express');
const mongoose = require('mongoose');
const { db } = require('../config/database');
const Match = require('../models/Match');

const router = express.Router();

// GET /api/health - Basic health check
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0'
    };

    // Check database connection (demo mode)
    if (db.isConnected()) {
      health.database = 'connected (demo mode)';
    } else {
      health.database = 'disconnected';
      health.status = 'error';
    }

    // Check basic functionality (demo mode)
    try {
      const orderCount = db.orders.size;
      const matchCount = 0; // No matches stored in demo mode
      
      health.stats = {
        totalOrders: orderCount,
        totalMatches: matchCount
      };
    } catch (dbError) {
      health.database = 'error';
      health.status = 'error';
      health.error = dbError.message;
    }

    const statusCode = health.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(health);

  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date(),
      error: error.message
    });
  }
});

// GET /api/health/detailed - Detailed system status
router.get('/detailed', async (req, res) => {
  try {
    const detailed = {
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Database health
    detailed.database = {
      status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };

    // System stats
    try {
      const [
        totalOrders,
        openOrders,
        filledOrders,
        totalMatches,
        pendingMatches,
        executedMatches
      ] = await Promise.all([
        Order.countDocuments(),
        Order.countDocuments({ orderStatus: 'open' }),
        Order.countDocuments({ orderStatus: 'filled' }),
        Match.countDocuments(),
        Match.countDocuments({ matchStatus: 'pending' }),
        Match.countDocuments({ matchStatus: 'executed' })
      ]);

      detailed.statistics = {
        orders: {
          total: totalOrders,
          open: openOrders,
          filled: filledOrders
        },
        matches: {
          total: totalMatches,
          pending: pendingMatches,
          executed: executedMatches
        }
      };

      // Active trading pairs
      const activePairs = await Order.distinct('tokenPair', {
        orderStatus: 'open',
        expiry: { $gt: new Date() }
      });

      detailed.statistics.activePairs = activePairs.length;

    } catch (statsError) {
      detailed.statistics = { error: statsError.message };
      detailed.status = 'degraded';
    }

    // Recent activity
    try {
      const recentOrders = await Order.countDocuments({
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
      });

      const recentMatches = await Match.countDocuments({
        matchedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });

      detailed.activity = {
        last24h: {
          orders: recentOrders,
          matches: recentMatches
        }
      };

    } catch (activityError) {
      detailed.activity = { error: activityError.message };
    }

    const statusCode = detailed.status === 'ok' ? 200 : 503;
    res.status(statusCode).json(detailed);

  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date(),
      error: error.message
    });
  }
});

module.exports = router; 