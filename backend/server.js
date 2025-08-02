const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const logger = require('./utils/logger');
const { connectDB } = require('./config/database');
const { startMatchingEngine } = require('./services/matchingEngine');

// Import routes
const orderRoutes = require('./routes/orders');
const orderbookRoutes = require('./routes/orderbook');
const tradeRoutes = require('./routes/trades');
const healthRoutes = require('./routes/health');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Make io available to routes
app.set('io', io);

// Routes
app.use('/api/orders', orderRoutes);
app.use('/api/orderbook', orderbookRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/health', healthRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('subscribe-orderbook', (tokenPair) => {
    socket.join(`orderbook:${tokenPair}`);
    logger.info(`Client ${socket.id} subscribed to orderbook:${tokenPair}`);
  });
  
  socket.on('subscribe-trades', (userAddress) => {
    socket.join(`trades:${userAddress}`);
    logger.info(`Client ${socket.id} subscribed to trades:${userAddress}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 8080;

async function startServer() {
  try {
    // Connect to database
    await connectDB();
    
    // Start matching engine
    await startMatchingEngine(io);
    
    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`🚀 Crossline backend server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 Database: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

startServer(); 