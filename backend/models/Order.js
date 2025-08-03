const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  // Core order data
  maker: {
    type: String,
    required: true,
    lowercase: true,
    match: /^0x[a-fA-F0-9]{40}$/,
    index: true
  },
  sellToken: {
    type: String,
    required: true,
    lowercase: true,
    match: /^0x[a-fA-F0-9]{40}$/
  },
  buyToken: {
    type: String,
    required: true,
    lowercase: true,
    match: /^0x[a-fA-F0-9]{40}$/
  },
  sellAmount: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d+$/.test(v) && BigInt(v) > 0;
      },
      message: 'sellAmount must be a positive integer string'
    }
  },
  buyAmount: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^\d+$/.test(v) && BigInt(v) > 0;
      },
      message: 'buyAmount must be a positive integer string'
    }
  },
  
  // Order metadata
  nonce: {
    type: String,
    required: true,
    index: true,
    unique: true
  },
  expiry: {
    type: Date,
    required: true,
    index: true
  },
  chainId: {
    type: Number,
    required: true,
    default: 11155111 // Sepolia
  },
  
  // Signature and verification
  signature: {
    type: String,
    required: true,
    match: /^0x[a-fA-F0-9]{130}$/ // 65 bytes in hex
  },
  orderHash: {
    type: String,
    required: true,
    unique: true,
    match: /^0x[a-fA-F0-9]{64}$/ // 32 bytes in hex
  },
  
  // Order status and execution
  status: {
    type: String,
    enum: ['active', 'filled', 'cancelled', 'expired'],
    default: 'active',
    index: true
  },
  filledAmount: {
    type: String,
    default: '0',
    validate: {
      validator: function(v) {
        return /^\d+$/.test(v) && BigInt(v) >= 0;
      },
      message: 'filledAmount must be a non-negative integer string'
    }
  },
  remainingAmount: {
    type: String,
    validate: {
      validator: function(v) {
        return /^\d+$/.test(v) && BigInt(v) >= 0;
      },
      message: 'remainingAmount must be a non-negative integer string'
    }
  },
  
  // Cross-chain data
  sourceChain: {
    type: String,
    default: 'ethereum'
  },
  targetChain: {
    type: String,
    default: 'ethereum'
  },
  
  // Trading data
  price: {
    type: Number,
    required: true,
    min: 0
  },
  tokenPair: {
    type: String,
    required: false, // Auto-generated in pre-save hook
    index: true
  },
  
  // Execution data
  executedAt: {
    type: Date,
    index: true
  },
  executionTxHash: {
    type: String,
    match: /^0x[a-fA-F0-9]{64}$/
  },
  gasUsed: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || (/^\d+$/.test(v) && BigInt(v) >= 0);
      },
      message: 'gasUsed must be a non-negative integer string'
    }
  },
  
  // Metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    version: {
      type: String,
      default: '1.0'
    },
    referrer: String
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt
  versionKey: false
});

// Indexes for performance
orderSchema.index({ maker: 1, status: 1 });
orderSchema.index({ tokenPair: 1, status: 1 });
orderSchema.index({ expiry: 1, status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ price: 1, tokenPair: 1 });

// Virtual for checking if order is expired
orderSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiry;
});

// Pre-save middleware
orderSchema.pre('save', function(next) {
  // Calculate remaining amount if not set
  if (!this.remainingAmount) {
    this.remainingAmount = (BigInt(this.sellAmount) - BigInt(this.filledAmount)).toString();
  }
  
  // Generate token pair if not set
  if (!this.tokenPair) {
    this.tokenPair = `${this.sellToken}/${this.buyToken}`;
  }
  
  // Update status based on filled amount
  if (BigInt(this.filledAmount) >= BigInt(this.sellAmount)) {
    this.status = 'filled';
    this.executedAt = this.executedAt || new Date();
  }
  
  // Check if expired
  if (this.isExpired && this.status === 'active') {
    this.status = 'expired';
  }
  
  next();
});

// Static methods
orderSchema.statics.findActiveOrders = function(filters = {}) {
  return this.find({
    status: 'active',
    expiry: { $gt: new Date() },
    ...filters
  }).sort({ createdAt: -1 });
};

orderSchema.statics.findByMaker = function(maker, status = null) {
  const query = { maker: maker.toLowerCase() };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ createdAt: -1 });
};

orderSchema.statics.findByTokenPair = function(tokenPair, status = 'active') {
  return this.find({
    tokenPair,
    status,
    expiry: { $gt: new Date() }
  }).sort({ price: 1 });
};

// Instance methods
orderSchema.methods.cancel = function() {
  this.status = 'cancelled';
  return this.save();
};

orderSchema.methods.fill = function(amount, txHash = null) {
  const fillAmount = BigInt(amount);
  const currentFilled = BigInt(this.filledAmount);
  const sellAmount = BigInt(this.sellAmount);
  
  if (currentFilled + fillAmount > sellAmount) {
    throw new Error('Fill amount exceeds remaining order amount');
  }
  
  this.filledAmount = (currentFilled + fillAmount).toString();
  this.remainingAmount = (sellAmount - currentFilled - fillAmount).toString();
  
  if (currentFilled + fillAmount >= sellAmount) {
    this.status = 'filled';
    this.executedAt = new Date();
  }
  
  if (txHash) {
    this.executionTxHash = txHash;
  }
  
  return this.save();
};

// Export the model
module.exports = mongoose.model('Order', orderSchema); 