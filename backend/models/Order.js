const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  // User Information
  userAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Order Details
  sellToken: {
    address: { type: String, required: true, lowercase: true },
    symbol: { type: String, required: true, uppercase: true },
    decimals: { type: Number, required: true }
  },
  
  buyToken: {
    address: { type: String, required: true, lowercase: true },
    symbol: { type: String, required: true, uppercase: true },
    decimals: { type: Number, required: true }
  },
  
  // Order Amounts
  sellAmount: {
    type: String, // Use string to handle large numbers (wei)
    required: true
  },
  
  buyAmount: {
    type: String, // Minimum amount to receive
    required: true
  },
  
  // Price (calculated: buyAmount / sellAmount)
  price: {
    type: Number,
    required: true,
    index: true
  },
  
  // Chain Information
  sourceChain: {
    type: String,
    required: true,
    enum: ['ethereum', 'polygon', 'arbitrum', 'localhost'],
    default: 'ethereum'
  },
  
  targetChain: {
    type: String,
    required: true,
    enum: ['ethereum', 'polygon', 'arbitrum', 'localhost'],
    default: 'ethereum'
  },
  
  // Order Metadata
  orderType: {
    type: String,
    required: true,
    enum: ['buy', 'sell'],
    index: true
  },
  
  orderStatus: {
    type: String,
    required: true,
    enum: ['open', 'matched', 'partially_filled', 'filled', 'cancelled', 'expired'],
    default: 'open',
    index: true
  },
  
  // Timing
  expiry: {
    type: Date,
    required: true,
    index: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Cryptographic
  signature: {
    type: String,
    required: true
  },
  
  nonce: {
    type: String,
    required: true,
    unique: true // Prevent replay attacks
  },
  
  // Order Book
  tokenPair: {
    type: String,
    required: true,
    index: true // e.g., "WETH-USDC"
  },
  
  // Execution tracking
  filledAmount: {
    type: String,
    default: '0'
  },
  
  remainingAmount: {
    type: String
  },
  
  // Matching
  matchedWith: [{
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    matchedAmount: String,
    matchedAt: Date
  }],
  
  // Transaction tracking
  executionTxHash: {
    type: String,
    default: null
  },
  
  executedAt: {
    type: Date,
    default: null
  },
  
  // Additional metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    version: { type: String, default: '1.0' }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
OrderSchema.index({ tokenPair: 1, orderType: 1, price: 1 });
OrderSchema.index({ userAddress: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1, expiry: 1 });
OrderSchema.index({ sourceChain: 1, targetChain: 1 });

// Virtual for token pair generation
OrderSchema.virtual('formattedTokenPair').get(function() {
  return `${this.sellToken.symbol}-${this.buyToken.symbol}`;
});

// Pre-save middleware
OrderSchema.pre('save', function(next) {
  // Set token pair
  this.tokenPair = `${this.sellToken.symbol}-${this.buyToken.symbol}`;
  
  // Calculate remaining amount
  if (!this.remainingAmount) {
    this.remainingAmount = this.sellAmount;
  }
  
  next();
});

// Methods
OrderSchema.methods.isExpired = function() {
  return new Date() > this.expiry;
};

OrderSchema.methods.canBeMatched = function() {
  return this.orderStatus === 'open' && !this.isExpired();
};

OrderSchema.methods.getOppositeOrderType = function() {
  return this.orderType === 'buy' ? 'sell' : 'buy';
};

module.exports = mongoose.model('Order', OrderSchema); 