const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // User and order identification
  userAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Order details
  sellToken: {
    address: { type: String, required: true, lowercase: true },
    symbol: { type: String, required: true },
    decimals: { type: Number, required: true }
  },
  buyToken: {
    address: { type: String, required: true, lowercase: true },
    symbol: { type: String, required: true },
    decimals: { type: Number, required: true }
  },
  
  // Amounts and pricing
  sellAmount: {
    type: String, // Using string to handle large numbers
    required: true
  },
  buyAmount: {
    type: String, // Minimum amount to receive
    required: true
  },
  price: {
    type: Number, // Price = buyAmount / sellAmount
    required: true,
    index: true
  },
  
  // Chain information
  sourceChain: {
    type: String,
    required: true,
    enum: ['ethereum', 'polygon', 'arbitrum', 'localhost']
  },
  targetChain: {
    type: String,
    required: true,
    enum: ['ethereum', 'polygon', 'arbitrum', 'localhost']
  },
  
  // Order lifecycle
  orderStatus: {
    type: String,
    required: true,
    enum: ['open', 'matched', 'filled', 'cancelled', 'expired'],
    default: 'open',
    index: true
  },
  
  // Signature and validation
  signature: {
    type: String,
    required: true
  },
  nonce: {
    type: String,
    required: true
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  filledAt: {
    type: Date
  },
  
  // Execution details
  fillAmount: {
    type: String,
    default: '0'
  },
  executionTxHash: {
    type: String
  },
  
  // Matching information
  matchedWith: [{
    orderId: String,
    matchedAmount: String,
    matchedAt: Date
  }]
}, {
  timestamps: true
});

// Indexes for performance
orderSchema.index({ sellToken: 1, buyToken: 1 });
orderSchema.index({ price: 1, orderStatus: 1 });
orderSchema.index({ expiresAt: 1 });
orderSchema.index({ createdAt: -1 });

// Pre-save middleware to generate orderId
orderSchema.pre('save', function(next) {
  if (!this.orderId) {
    this.orderId = `order_${this.userAddress}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema); 