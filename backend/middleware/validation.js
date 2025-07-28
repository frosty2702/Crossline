const { body, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Ethereum address regex
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Token validation
const validateToken = [
  body('address').matches(ETH_ADDRESS_REGEX).withMessage('Invalid token address'),
  body('symbol').isLength({ min: 1, max: 10 }).withMessage('Symbol must be 1-10 characters'),
  body('decimals').isInt({ min: 0, max: 18 }).withMessage('Decimals must be 0-18')
];

// Order validation middleware
const validateOrder = [
  // User address
  body('userAddress')
    .matches(ETH_ADDRESS_REGEX)
    .withMessage('Invalid user address'),
  
  // Sell token
  body('sellToken.address')
    .matches(ETH_ADDRESS_REGEX)
    .withMessage('Invalid sell token address'),
  body('sellToken.symbol')
    .isLength({ min: 1, max: 10 })
    .withMessage('Sell token symbol must be 1-10 characters'),
  body('sellToken.decimals')
    .isInt({ min: 0, max: 18 })
    .withMessage('Sell token decimals must be 0-18'),
  
  // Buy token
  body('buyToken.address')
    .matches(ETH_ADDRESS_REGEX)
    .withMessage('Invalid buy token address'),
  body('buyToken.symbol')
    .isLength({ min: 1, max: 10 })
    .withMessage('Buy token symbol must be 1-10 characters'),
  body('buyToken.decimals')
    .isInt({ min: 0, max: 18 })
    .withMessage('Buy token decimals must be 0-18'),
  
  // Amounts (as strings to handle large numbers)
  body('sellAmount')
    .isString()
    .matches(/^\d+$/)
    .withMessage('Sell amount must be a positive integer string'),
  body('buyAmount')
    .isString()
    .matches(/^\d+$/)
    .withMessage('Buy amount must be a positive integer string'),
  
  // Order type
  body('orderType')
    .isIn(['buy', 'sell'])
    .withMessage('Order type must be buy or sell'),
  
  // Chains
  body('sourceChain')
    .optional()
    .isIn(['ethereum', 'polygon', 'arbitrum', 'localhost'])
    .withMessage('Invalid source chain'),
  body('targetChain')
    .optional()
    .isIn(['ethereum', 'polygon', 'arbitrum', 'localhost'])
    .withMessage('Invalid target chain'),
  
  // Expiry (timestamp in milliseconds)
  body('expiry')
    .isInt({ min: Date.now() })
    .withMessage('Expiry must be a future timestamp'),
  
  // Signature
  body('signature')
    .matches(/^0x[a-fA-F0-9]{130}$/)
    .withMessage('Invalid signature format'),
  
  // Nonce
  body('nonce')
    .isString()
    .isLength({ min: 1, max: 66 })
    .withMessage('Invalid nonce'),
  
  // Custom validation logic
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { sellToken, buyToken, sellAmount, buyAmount, expiry } = req.body;
    
    // Check tokens are different
    if (sellToken.address.toLowerCase() === buyToken.address.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Sell and buy tokens must be different'
      });
    }
    
    // Check amounts are positive
    if (BigInt(sellAmount) <= 0 || BigInt(buyAmount) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amounts must be positive'
      });
    }
    
    // Check expiry is not too far in future (max 30 days)
    const maxExpiry = Date.now() + (30 * 24 * 60 * 60 * 1000);
    if (expiry > maxExpiry) {
      return res.status(400).json({
        success: false,
        error: 'Expiry cannot be more than 30 days in the future'
      });
    }
    
    // Check reasonable price range
    const sellAmountFloat = parseFloat(sellAmount);
    const buyAmountFloat = parseFloat(buyAmount);
    const price = buyAmountFloat / sellAmountFloat;
    
    if (price <= 0 || price > 1e12) {
      return res.status(400).json({
        success: false,
        error: 'Price is outside reasonable range'
      });
    }
    
    next();
  }
];

// Rate limiting per user
const rateLimitByUser = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const userAddress = req.body.userAddress || req.params.userAddress;
    
    if (!userAddress) {
      return next();
    }
    
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean old entries
    for (const [address, timestamps] of requests.entries()) {
      requests.set(address, timestamps.filter(t => t > windowStart));
      if (requests.get(address).length === 0) {
        requests.delete(address);
      }
    }
    
    // Check current user
    const userRequests = requests.get(userAddress.toLowerCase()) || [];
    
    if (userRequests.length >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests from this address',
        retryAfter: Math.ceil((userRequests[0] + windowMs - now) / 1000)
      });
    }
    
    // Add current request
    userRequests.push(now);
    requests.set(userAddress.toLowerCase(), userRequests);
    
    next();
  };
};

// Sanitize input
const sanitizeInput = (req, res, next) => {
  // Convert addresses to lowercase
  if (req.body.userAddress) {
    req.body.userAddress = req.body.userAddress.toLowerCase();
  }
  
  if (req.body.sellToken && req.body.sellToken.address) {
    req.body.sellToken.address = req.body.sellToken.address.toLowerCase();
  }
  
  if (req.body.buyToken && req.body.buyToken.address) {
    req.body.buyToken.address = req.body.buyToken.address.toLowerCase();
  }
  
  // Convert symbols to uppercase
  if (req.body.sellToken && req.body.sellToken.symbol) {
    req.body.sellToken.symbol = req.body.sellToken.symbol.toUpperCase();
  }
  
  if (req.body.buyToken && req.body.buyToken.symbol) {
    req.body.buyToken.symbol = req.body.buyToken.symbol.toUpperCase();
  }
  
  next();
};

// Error handler for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', {
      errors: errors.array(),
      body: req.body,
      ip: req.ip
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

module.exports = {
  validateOrder,
  validateToken,
  rateLimitByUser,
  sanitizeInput,
  handleValidationErrors,
  ETH_ADDRESS_REGEX
}; 