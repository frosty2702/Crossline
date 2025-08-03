const express = require('express');
const { getConnectionStatus, healthCheck } = require('../config/database');
const Order = require('../models/Order');
const Match = require('../models/Match');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/health - Comprehensive health check
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      service: 'crossline-backend'
    };

    // Check database connection
    const dbStatus = getConnectionStatus();
    const dbHealth = await healthCheck();
    
    health.database = {
      status: dbHealth.status,
      connected: dbStatus.isConnected,
      host: dbStatus.host,
      port: dbStatus.port,
      name: dbStatus.name,
      readyState: dbStatus.readyState
    };

    if (dbHealth.status !== 'healthy') {
      health.status = 'degraded';
      health.database.error = dbHealth.error;
    }

    // Get database statistics
    try {
      if (dbStatus.isConnected) {
        const [totalOrders, activeOrders, totalMatches] = await Promise.all([
          Order.countDocuments(),
          Order.countDocuments({ status: 'active', expiry: { $gt: new Date() } }),
          Match.countDocuments()
        ]);
        
        health.stats = {
          totalOrders,
          activeOrders,
          totalMatches,
          lastCheck: new Date()
        };
      } else {
        health.stats = {
          totalOrders: 0,
          activeOrders: 0,
          totalMatches: 0,
          note: 'Database not connected'
        };
      }
    } catch (statsError) {
      logger.warn('Failed to fetch database stats:', statsError.message);
      health.stats = {
        error: 'Failed to fetch statistics',
        totalOrders: 0,
        activeOrders: 0,
        totalMatches: 0
      };
    }

    // Memory usage
    const memUsage = process.memoryUsage();
    health.memory = {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      external: Math.round(memUsage.external / 1024 / 1024) + 'MB'
    };

    // API endpoints status
    health.endpoints = {
      orders: 'operational',
      orderbook: 'operational',
      trades: 'operational',
      health: 'operational'
    };

    const httpStatus = health.status === 'ok' ? 200 : 
                      health.status === 'degraded' ? 200 : 500;

    res.status(httpStatus).json(health);

  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date(),
      message: 'Health check failed',
      error: error.message
    });
  }
});

// GET /api/health/database - Detailed database health
router.get('/database', async (req, res) => {
  try {
    const dbStatus = getConnectionStatus();
    const dbHealth = await healthCheck();
    
    const response = {
      ...dbStatus,
      health: dbHealth,
      collections: {}
    };

    if (dbStatus.isConnected) {
      try {
        // Get collection stats
        const orderStats = await Order.collection.stats();
        const matchStats = await Match.collection.stats();
        
        response.collections = {
          orders: {
            count: orderStats.count,
            size: orderStats.size,
            avgObjSize: orderStats.avgObjSize
          },
          matches: {
            count: matchStats.count,
            size: matchStats.size,
            avgObjSize: matchStats.avgObjSize
          }
        };
      } catch (collectionError) {
        response.collections = { error: collectionError.message };
      }
    }

    res.json(response);

  } catch (error) {
    logger.error('Database health check error:', error);
    res.status(500).json({
      error: 'Database health check failed',
      message: error.message
    });
  }
});

module.exports = router; 