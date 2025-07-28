const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  // Order References
  buyOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  
  sellOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  
  // Match Details
  tokenPair: {
    type: String,
    required: true,
    index: true
  },
  
  matchedPrice: {
    type: Number,
    required: true
  },
  
  matchedAmount: {
    type: String, // Amount in sell token (wei)
    required: true
  },
  
  buyAmount: {
    type: String, // Amount in buy token (wei)
    required: true
  },
  
  // Users involved
  buyerAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  sellerAddress: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Match Status
  matchStatus: {
    type: String,
    required: true,
    enum: ['pending', 'verified', 'executed', 'failed', 'expired'],
    default: 'pending',
    index: true
  },
  
  // Execution Details
  executionTxHash: {
    type: String,
    default: null
  },
  
  executedAt: {
    type: Date,
    default: null
  },
  
  gasUsed: {
    type: String,
    default: null
  },
  
  gasPrice: {
    type: String,
    default: null
  },
  
  // Chain Information
  executionChain: {
    type: String,
    required: true,
    enum: ['ethereum', 'polygon', 'arbitrum', 'localhost']
  },
  
  // Cross-chain details (if applicable)
  crossChainDetails: {
    sourceChain: String,
    targetChain: String,
    bridgeTxHash: String,
    bridgeStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed']
    }
  },
  
  // Timing
  matchedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  expiresAt: {
    type: Date,
    required: true,
    index: true // Matches expire after a certain time if not executed
  },
  
  // Fee Information
  fees: {
    relayerFee: { type: String, default: '0' },
    protocolFee: { type: String, default: '0' },
    gasFee: { type: String, default: '0' }
  },
  
  // Error tracking
  errorMessage: {
    type: String,
    default: null
  },
  
  retryCount: {
    type: Number,
    default: 0
  },
  
  // Metadata
  metadata: {
    matchingAlgorithm: { type: String, default: 'price-time-priority' },
    version: { type: String, default: '1.0' },
    relayerAddress: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
MatchSchema.index({ buyerAddress: 1, createdAt: -1 });
MatchSchema.index({ sellerAddress: 1, createdAt: -1 });
MatchSchema.index({ matchStatus: 1, expiresAt: 1 });
MatchSchema.index({ executionChain: 1, matchedAt: -1 });
MatchSchema.index({ tokenPair: 1, matchedAt: -1 });

// Methods
MatchSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

MatchSchema.methods.canBeExecuted = function() {
  return this.matchStatus === 'verified' && !this.isExpired();
};

MatchSchema.methods.markAsExecuted = function(txHash, gasUsed, gasPrice) {
  this.matchStatus = 'executed';
  this.executionTxHash = txHash;
  this.executedAt = new Date();
  this.gasUsed = gasUsed;
  this.gasPrice = gasPrice;
  return this.save();
};

MatchSchema.methods.markAsFailed = function(errorMessage) {
  this.matchStatus = 'failed';
  this.errorMessage = errorMessage;
  this.retryCount += 1;
  return this.save();
};

// Static methods
MatchSchema.statics.getTradeHistory = function(userAddress, limit = 50) {
  return this.find({
    $or: [
      { buyerAddress: userAddress.toLowerCase() },
      { sellerAddress: userAddress.toLowerCase() }
    ],
    matchStatus: 'executed'
  })
  .populate('buyOrderId sellOrderId')
  .sort({ executedAt: -1 })
  .limit(limit);
};

MatchSchema.statics.getActiveMatches = function() {
  return this.find({
    matchStatus: { $in: ['pending', 'verified'] },
    expiresAt: { $gt: new Date() }
  }).populate('buyOrderId sellOrderId');
};

module.exports = mongoose.model('Match', MatchSchema); 