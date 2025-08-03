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
const MatchingEngine = require('./services/matchingEngine');

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

// Initialize matching engine
let matchingEngine = null;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://127.0.0.1:3002'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);

// Store io instance for use in routes
app.set('io', io);

// Routes
app.use('/api/orders', orderRoutes);
app.use('/api/orderbook', orderbookRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/health', healthRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'Crossline Backend API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date(),
    endpoints: {
      health: '/api/health',
      orders: '/api/orders',
      orderbook: '/api/orderbook',
      trades: '/api/trades'
    }
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  // Join orderbook room
  socket.on('join-orderbook', (tokenPair) => {
    socket.join(`orderbook:${tokenPair}`);
    logger.debug(`Client ${socket.id} joined orderbook: ${tokenPair}`);
  });
  
  // Join trades room
  socket.on('join-trades', (userAddress) => {
    socket.join(`trades:${userAddress}`);
    logger.debug(`Client ${socket.id} joined trades: ${userAddress}`);
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
    
    // Initialize and start matching engine
    matchingEngine = new MatchingEngine(io);
    await matchingEngine.start();
    
    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`🚀 Crossline backend server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'production'}`);
      logger.info(`🔗 Database: MongoDB Connected (${mongoose.connection.name})`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop matching engine
  if (matchingEngine) {
    matchingEngine.stop();
  }
  
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Stop matching engine
  if (matchingEngine) {
    matchingEngine.stop();
  }
  
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

startServer(); 