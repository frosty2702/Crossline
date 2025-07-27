const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  // Trade identification
  tradeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Orders involved in the trade
  buyOrderId: {
    type: String,
    required: true,
    index: true
  },
  sellOrderId: {
    type: String,
    required: true,
    index: true
  },
  
  // Traders
  buyer: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  seller: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  
  // Trade details
  tokenPair: {
    sellToken: {
      address: String,
      symbol: String
    },
    buyToken: {
      address: String,
      symbol: String
    }
  },
  
  // Execution details
  executedPrice: {
    type: Number,
    required: true
  },
  executedAmount: {
    type: String, // Amount of sellToken traded
    required: true
  },
  receivedAmount: {
    type: String, // Amount of buyToken received
    required: true
  },
  
  // Blockchain execution
  executionChain: {
    type: String,
    required: true,
    enum: ['ethereum', 'polygon', 'arbitrum', 'localhost']
  },
  txHash: {
    type: String,
    required: true,
    index: true
  },
  blockNumber: {
    type: Number
  },
  gasUsed: {
    type: String
  },
  
  // Fees
  relayerFee: {
    type: String,
    default: '0'
  },
  protocolFee: {
    type: String,
    default: '0'
  },
  
  // Status
  tradeStatus: {
    type: String,
    required: true,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending'
  },
  
  // Timestamps
  matchedAt: {
    type: Date,
    required: true
  },
  executedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  confirmedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for queries
tradeSchema.index({ buyer: 1, executedAt: -1 });
tradeSchema.index({ seller: 1, executedAt: -1 });
tradeSchema.index({ 'tokenPair.sellToken.address': 1, 'tokenPair.buyToken.address': 1 });
tradeSchema.index({ executedAt: -1 });

// Pre-save middleware to generate tradeId
tradeSchema.pre('save', function(next) {
  if (!this.tradeId) {
    this.tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

module.exports = mongoose.model('Trade', tradeSchema); 