require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');

// Database and blockchain setup
const connectDB = require('./config/database');
const { initializeProviders } = require('./config/blockchain');

// Routes (to be created)
// const orderRoutes = require('./routes/orders');
// const userRoutes = require('./routes/users');
// const matchRoutes = require('./routes/matches');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB
connectDB();

// Initialize blockchain providers
initializeProviders();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Crossline API',
    version: '1.0.0',
    description: 'Cross-chain gasless limit orders with MEV protection',
    supportedChains: [1, 137, 42161, 31337],
    features: [
      'Custom limit orders',
      'Cross-chain execution',
      'MEV protection',
      'Real-time order book',
      'Trade history'
    ],
    endpoints: {
      orders: '/api/orders',
      users: '/api/users',
      matches: '/api/matches',
      orderbook: '/api/orderbook'
    }
  });
});

// API Routes (placeholder - will be uncommented as we create them)
// app.use('/api/orders', orderRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/matches', matchRoutes);

// Temporary test routes for development
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Crossline API is running!',
    timestamp: new Date().toISOString()
  });
});

// Socket.IO for real-time updates
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('subscribe_orderbook', (tokenPair) => {
    socket.join(`orderbook_${tokenPair}`);
    console.log(`Client ${socket.id} subscribed to orderbook: ${tokenPair}`);
  });
  
  socket.on('subscribe_user_orders', (userAddress) => {
    socket.join(`user_${userAddress.toLowerCase()}`);
    console.log(`Client ${socket.id} subscribed to user orders: ${userAddress}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Make io available to routes
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      error: 'Validation Error',
      details: errors
    });
  }
  
  // MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      error: 'Duplicate Error',
      message: 'Resource already exists'
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Please provide a valid authentication token'
    });
  }
  
  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`
🚀 Crossline API Server Running!
📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🎯 Health Check: http://localhost:${PORT}/health
📊 API Info: http://localhost:${PORT}/api/info
⚡ Socket.IO: Ready for real-time connections
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io }; 