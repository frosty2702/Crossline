const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Order Identification
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
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
  
  // Amounts and Pricing
  sellAmount: {
    type: String, // Use string for big numbers
    required: true
  },
  buyAmount: {
    type: String, // Use string for big numbers
    required: true
  },
  price: {
    type: Number, // Calculated price for matching
    required: true,
    index: true
  },
  
  // Chain Information
  sourceChain: {
    type: Number, // Chain ID
    required: true,
    index: true
  },
  targetChain: {
    type: Number, // Chain ID
    required: true,
    index: true
  },
  
  // Order Lifecycle
  orderStatus: {
    type: String,
    enum: ['open', 'partially_filled', 'filled', 'cancelled', 'expired'],
    default: 'open',
    index: true
  },
  
  // Execution Details
  filledAmount: {
    type: String,
    default: '0'
  },
  remainingAmount: {
    type: String,
    required: true
  },
  
  // Timestamps
  expiryTime: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Signature and Security
  signature: {
    v: Number,
    r: String,
    s: String,
    signatureType: { type: String, default: 'EIP712' }
  },
  nonce: {
    type: String,
    required: true
  },
  
  // Optional Features
  allowPartialFill: {
    type: Boolean,
    default: true
  },
  minFillAmount: {
    type: String,
    default: '0'
  },
  
  // Execution History
  executionHistory: [{
    txHash: String,
    blockNumber: Number,
    executedAmount: String,
    executedAt: Date,
    gasCost: String
  }]
}, {
  timestamps: true
});

// Indexes for efficient querying
orderSchema.index({ sellToken: 1, buyToken: 1 });
orderSchema.index({ sourceChain: 1, targetChain: 1 });
orderSchema.index({ price: 1, orderStatus: 1 });
orderSchema.index({ expiryTime: 1, orderStatus: 1 });

// Methods
orderSchema.methods.isExpired = function() {
  return new Date() > this.expiryTime;
};

orderSchema.methods.isActive = function() {
  return this.orderStatus === 'open' || this.orderStatus === 'partially_filled';
};

orderSchema.methods.canFill = function(amount) {
  const remaining = BigInt(this.remainingAmount);
  const requested = BigInt(amount);
  return requested <= remaining;
};

module.exports = mongoose.model('Order', orderSchema); 