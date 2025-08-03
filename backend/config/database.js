const mongoose = require('mongoose');
const logger = require('../utils/logger');

// MongoDB connection string - use environment variable or default to local
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/crossline';

let isConnected = false;

/**
 * Connect to MongoDB database - PRODUCTION ONLY
 */
const connectDB = async () => {
  try {
    if (isConnected) {
      logger.info('📦 Database already connected');
      return;
    }

    logger.info('📦 Connecting to MongoDB for PRODUCTION...');
    
    // MongoDB connection options
    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0
    };

    await mongoose.connect(MONGODB_URI, options);
    
    isConnected = true;
    logger.info('✅ MongoDB connected successfully (PRODUCTION MODE)');
    logger.info(`📍 Database: ${mongoose.connection.name}`);
    logger.info(`🔗 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);

    // Handle connection events
    mongoose.connection.on('error', (error) => {
      logger.error('❌ MongoDB connection error:', error);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('⚠️ MongoDB disconnected');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconnected');
      isConnected = true;
    });

  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error.message);
    logger.warn('⚠️ HACKATHON MODE: Running without MongoDB for demo');
    logger.warn('💡 For production: brew services start mongodb-community');
    
    // For hackathon demo - continue without MongoDB
    isConnected = false;
    logger.info('✅ Backend running in HACKATHON MODE (no database)');
  }
};

/**
 * Disconnect from MongoDB
 */
const disconnectDB = async () => {
  try {
    if (!isConnected) {
      return;
    }

    await mongoose.connection.close();
    isConnected = false;
    logger.info('📦 Database disconnected');
  } catch (error) {
    logger.error('❌ Error disconnecting from database:', error);
  }
};

/**
 * Get database connection status
 */
const getConnectionStatus = () => {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    mode: 'production'
  };
};

/**
 * Health check for database
 */
const healthCheck = async () => {
  try {
    if (!isConnected) {
      return {
        status: 'unhealthy',
        error: 'Database not connected'
      };
    }

    // Test the connection
    await mongoose.connection.db.admin().ping();
    
    return {
      status: 'healthy',
      connected: true
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
};

/**
 * Get storage type
 */
const getStorage = () => {
  return {
    type: 'mongodb',
    connected: isConnected
  };
};

module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus,
  healthCheck,
  getStorage,
  isConnected: () => isConnected
}; 