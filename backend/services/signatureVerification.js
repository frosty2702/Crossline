const { ethers } = require('ethers');
const logger = require('../utils/logger');

// EIP-712 Domain
const DOMAIN = {
  name: 'Crossline',
  version: '1',
  chainId: 1, // Will be dynamic based on order
  verifyingContract: '0x0000000000000000000000000000000000000000' // Placeholder, will be set after contract deployment
};

// EIP-712 Types
const ORDER_TYPES = {
  Order: [
    { name: 'userAddress', type: 'address' },
    { name: 'sellToken', type: 'address' },
    { name: 'buyToken', type: 'address' },
    { name: 'sellAmount', type: 'uint256' },
    { name: 'buyAmount', type: 'uint256' },
    { name: 'sourceChain', type: 'uint256' },
    { name: 'targetChain', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
};

// Chain ID mapping
const CHAIN_IDS = {
  'ethereum': 1,
  'polygon': 137,
  'arbitrum': 42161,
  'localhost': 31337
};

/**
 * Verify EIP-712 signature for an order
 * @param {Object} orderData - The order data to verify
 * @returns {boolean} - True if signature is valid
 */
async function verifySignature(orderData) {
  try {
    const {
      userAddress,
      sellToken,
      buyToken,
      sellAmount,
      buyAmount,
      sourceChain = 'ethereum',
      targetChain = 'ethereum',
      expiry,
      nonce,
      signature
    } = orderData;

    // Prepare domain with correct chain ID
    const domain = {
      ...DOMAIN,
      chainId: CHAIN_IDS[sourceChain] || 1
    };

    // Prepare order struct for hashing
    const orderStruct = {
      userAddress: userAddress,
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: sellAmount,
      buyAmount: buyAmount,
      sourceChain: CHAIN_IDS[sourceChain] || 1,
      targetChain: CHAIN_IDS[targetChain] || 1,
      expiry: expiry,
      nonce: nonce
    };

    // Create typed data hash
    const typedDataHash = ethers.TypedDataEncoder.hash(domain, ORDER_TYPES, orderStruct);
    
    // Recover signer address from signature
    const recoveredAddress = ethers.recoverAddress(typedDataHash, signature);
    
    // Compare with expected user address
    const isValid = recoveredAddress.toLowerCase() === userAddress.toLowerCase();
    
    if (!isValid) {
      logger.warn('Signature verification failed:', {
        expected: userAddress.toLowerCase(),
        recovered: recoveredAddress.toLowerCase(),
        orderStruct,
        domain
      });
    }
    
    return isValid;

  } catch (error) {
    logger.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Generate EIP-712 typed data for signing (utility for frontend)
 * @param {Object} orderData - The order data
 * @returns {Object} - Typed data for signing
 */
function generateTypedData(orderData) {
  const {
    userAddress,
    sellToken,
    buyToken,
    sellAmount,
    buyAmount,
    sourceChain = 'ethereum',
    targetChain = 'ethereum',
    expiry,
    nonce
  } = orderData;

  const domain = {
    ...DOMAIN,
    chainId: CHAIN_IDS[sourceChain] || 1
  };

  const orderStruct = {
    userAddress: userAddress,
    sellToken: sellToken.address,
    buyToken: buyToken.address,
    sellAmount: sellAmount,
    buyAmount: buyAmount,
    sourceChain: CHAIN_IDS[sourceChain] || 1,
    targetChain: CHAIN_IDS[targetChain] || 1,
    expiry: expiry,
    nonce: nonce
  };

  return {
    types: ORDER_TYPES,
    primaryType: 'Order',
    domain: domain,
    message: orderStruct
  };
}

/**
 * Verify cancellation signature
 * @param {string} orderId - Order ID to cancel
 * @param {string} userAddress - User address
 * @param {string} signature - Signature
 * @returns {boolean} - True if valid
 */
async function verifyCancellationSignature(orderId, userAddress, signature) {
  try {
    // Simple message signing for cancellation
    const message = `Cancel order: ${orderId}`;
    const messageHash = ethers.hashMessage(message);
    const recoveredAddress = ethers.recoverAddress(messageHash, signature);
    
    return recoveredAddress.toLowerCase() === userAddress.toLowerCase();
  } catch (error) {
    logger.error('Error verifying cancellation signature:', error);
    return false;
  }
}

/**
 * Create signature verification middleware
 * @param {boolean} required - Whether signature is required
 */
function requireSignature(required = true) {
  return async (req, res, next) => {
    if (!required) {
      return next();
    }

    try {
      const isValid = await verifySignature(req.body);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid signature'
        });
      }
      
      next();
    } catch (error) {
      logger.error('Signature verification middleware error:', error);
      res.status(500).json({
        success: false,
        error: 'Signature verification failed'
      });
    }
  };
}

/**
 * Generate nonce for order
 * @param {string} userAddress - User address
 * @returns {string} - Generated nonce
 */
function generateNonce(userAddress) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2);
  return `${userAddress.toLowerCase()}-${timestamp}-${random}`;
}

/**
 * Validate nonce format
 * @param {string} nonce - Nonce to validate
 * @param {string} userAddress - Expected user address
 * @returns {boolean} - True if valid format
 */
function validateNonce(nonce, userAddress) {
  if (!nonce || typeof nonce !== 'string') {
    return false;
  }
  
  const parts = nonce.split('-');
  if (parts.length !== 3) {
    return false;
  }
  
  const [address, timestamp, random] = parts;
  
  // Check address matches
  if (address !== userAddress.toLowerCase()) {
    return false;
  }
  
  // Check timestamp is reasonable (not too old, not in future)
  const ts = parseInt(timestamp);
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  if (isNaN(ts) || ts > now || ts < (now - maxAge)) {
    return false;
  }
  
  return true;
}

module.exports = {
  verifySignature,
  generateTypedData,
  verifyCancellationSignature,
  requireSignature,
  generateNonce,
  validateNonce,
  DOMAIN,
  ORDER_TYPES,
  CHAIN_IDS
}; 