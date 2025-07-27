const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  // Match Identification
  matchId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Order References
  buyOrderId: {
    type: String,
    required: true,
    index: true,
    ref: 'Order'
  },
  sellOrderId: {
    type: String,
    required: true,
    index: true,
    ref: 'Order'
  },
  
  // Match Details
  matchedPrice: {
    type: Number,
    required: true
  },
  matchedAmount: {
    type: String, // Use string for big numbers
    required: true
  },
  
  // Token Information
  tokenPair: {
    sellToken: {
      address: String,
      symbol: String,
      decimals: Number
    },
    buyToken: {
      address: String,
      symbol: String,
      decimals: Number
    }
  },
  
  // Chain Information
  executionChain: {
    type: Number, // Chain ID where the trade will be executed
    required: true
  },
  
  // Match Status
  matchStatus: {
    type: String,
    enum: ['pending', 'verified', 'executing', 'executed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Execution Details
  executionDetails: {
    txHash: String,
    blockNumber: Number,
    gasUsed: String,
    gasCost: String,
    executedAt: Date,
    relayerAddress: String
  },
  
  // Fee Information
  fees: {
    relayerFee: {
      amount: String,
      token: String
    },
    protocolFee: {
      amount: String,
      token: String
    },
    gasFee: {
      amount: String,
      token: String
    }
  },
  
  // Timestamps
  matchedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  verifiedAt: Date,
  executedAt: Date,
  
  // Error Handling
  errorMessage: String,
  retryCount: {
    type: Number,
    default: 0
  },
  maxRetries: {
    type: Number,
    default: 3
  },
  
  // Cross-chain specific
  crossChainMessage: {
    messageId: String,
    bridgeProtocol: String, // 'layerzero', 'axelar', etc.
    sourceChain: Number,
    targetChain: Number,
    messageStatus: String
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
matchSchema.index({ buyOrderId: 1, sellOrderId: 1 });
matchSchema.index({ matchStatus: 1, matchedAt: 1 });
matchSchema.index({ executionChain: 1, matchStatus: 1 });

// Methods
matchSchema.methods.canRetry = function() {
  return this.retryCount < this.maxRetries && 
         ['failed', 'pending'].includes(this.matchStatus);
};

matchSchema.methods.markAsExecuted = function(executionDetails) {
  this.matchStatus = 'executed';
  this.executedAt = new Date();
  this.executionDetails = executionDetails;
  return this.save();
};

matchSchema.methods.markAsFailed = function(errorMessage) {
  this.matchStatus = 'failed';
  this.errorMessage = errorMessage;
  this.retryCount += 1;
  return this.save();
};

module.exports = mongoose.model('Match', matchSchema); 