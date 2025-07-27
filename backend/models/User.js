const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // User Identification
  address: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  
  // User Profile (Optional)
  profile: {
    nickname: String,
    avatar: String,
    joinedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // Trading Statistics
  stats: {
    totalOrders: {
      type: Number,
      default: 0
    },
    successfulTrades: {
      type: Number,
      default: 0
    },
    failedTrades: {
      type: Number,
      default: 0
    },
    totalVolumeUSD: {
      type: Number,
      default: 0
    },
    successRate: {
      type: Number,
      default: 0
    },
    averageTradeSize: {
      type: Number,
      default: 0
    }
  },
  
  // Chain Activity
  chainActivity: {
    ethereum: {
      orders: { type: Number, default: 0 },
      volume: { type: Number, default: 0 }
    },
    polygon: {
      orders: { type: Number, default: 0 },
      volume: { type: Number, default: 0 }
    },
    arbitrum: {
      orders: { type: Number, default: 0 },
      volume: { type: Number, default: 0 }
    }
  },
  
  // User Preferences
  preferences: {
    defaultSlippage: {
      type: Number,
      default: 0.5 // 0.5%
    },
    defaultExpiry: {
      type: Number,
      default: 24 // hours
    },
    allowPartialFills: {
      type: Boolean,
      default: true
    },
    preferredChain: {
      type: Number,
      default: 1 // Ethereum
    }
  },
  
  // Security & Compliance
  security: {
    lastLoginAt: Date,
    loginCount: {
      type: Number,
      default: 0
    },
    isBlacklisted: {
      type: Boolean,
      default: false
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  },
  
  // Nonce Management
  nonces: {
    ethereum: {
      type: Number,
      default: 0
    },
    polygon: {
      type: Number,
      default: 0
    },
    arbitrum: {
      type: Number,
      default: 0
    }
  },
  
  // API Usage (if we implement API keys)
  apiUsage: {
    requestsToday: {
      type: Number,
      default: 0
    },
    lastRequestAt: Date,
    rateLimitExceeded: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ 'stats.totalVolumeUSD': -1 });
userSchema.index({ 'stats.successRate': -1 });
userSchema.index({ 'security.isBlacklisted': 1 });

// Methods
userSchema.methods.updateStats = function(orderValue, isSuccessful) {
  this.stats.totalOrders += 1;
  
  if (isSuccessful) {
    this.stats.successfulTrades += 1;
    this.stats.totalVolumeUSD += orderValue;
  } else {
    this.stats.failedTrades += 1;
  }
  
  // Recalculate success rate
  this.stats.successRate = (this.stats.successfulTrades / this.stats.totalOrders) * 100;
  
  // Recalculate average trade size
  if (this.stats.successfulTrades > 0) {
    this.stats.averageTradeSize = this.stats.totalVolumeUSD / this.stats.successfulTrades;
  }
  
  return this.save();
};

userSchema.methods.getNextNonce = function(chainId) {
  const chainKey = this.getChainKey(chainId);
  if (chainKey) {
    this.nonces[chainKey] += 1;
    return this.nonces[chainKey];
  }
  throw new Error(`Unsupported chain ID: ${chainId}`);
};

userSchema.methods.getChainKey = function(chainId) {
  const chainMap = {
    1: 'ethereum',
    137: 'polygon',
    42161: 'arbitrum'
  };
  return chainMap[chainId];
};

userSchema.methods.incrementApiUsage = function() {
  const today = new Date().toDateString();
  const lastRequestDate = this.apiUsage.lastRequestAt ? 
    this.apiUsage.lastRequestAt.toDateString() : null;
  
  if (today !== lastRequestDate) {
    this.apiUsage.requestsToday = 1;
  } else {
    this.apiUsage.requestsToday += 1;
  }
  
  this.apiUsage.lastRequestAt = new Date();
  return this.save();
};

module.exports = mongoose.model('User', userSchema); 