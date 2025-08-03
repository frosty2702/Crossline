const { ethers } = require('ethers');
const logger = require('../utils/logger');

// EIP-712 Domain
const DOMAIN = {
  name: 'Crossline',
  version: '1',
  chainId: 11155111, // Sepolia
  verifyingContract: '0x8B02e9416A0349A4934E0840485FA1Ed26FD21Ea' // CrosslineCore address
};

// Order type definition for EIP-712
const ORDER_TYPE = {
  Order: [
    { name: 'maker', type: 'address' },
    { name: 'sellToken', type: 'address' },
    { name: 'buyToken', type: 'address' },
    { name: 'sellAmount', type: 'uint256' },
    { name: 'buyAmount', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'chainId', type: 'uint256' }
  ]
};

/**
 * Verify EIP-712 signature for an order
 * @param {Object} orderData - The order data
 * @param {string} signature - The signature to verify
 * @returns {Promise<boolean>} - True if signature is valid
 */
async function verifyOrderSignature(orderData, signature) {
  try {
    // Prepare the order object for EIP-712
    const order = {
      maker: orderData.maker,
      sellToken: orderData.sellToken,
      buyToken: orderData.buyToken,
      sellAmount: orderData.sellAmount.toString(),
      buyAmount: orderData.buyAmount.toString(),
      expiry: orderData.expiry.toString(),
      nonce: orderData.nonce.toString(),
      chainId: orderData.chainId.toString()
    };

    // Create the typed data
    const typedData = {
      domain: DOMAIN,
      types: ORDER_TYPE,
      primaryType: 'Order',
      message: order
    };

    // Recover the signer address from the signature
    const recoveredAddress = ethers.verifyTypedData(
      typedData.domain,
      typedData.types,
      typedData.message,
      signature
    );

    // Check if recovered address matches the maker
    const isValid = recoveredAddress.toLowerCase() === orderData.maker.toLowerCase();
    
    if (isValid) {
      logger.info(`✅ Signature verified for order from ${orderData.maker}`);
    } else {
      logger.warn(`❌ Invalid signature for order from ${orderData.maker}. Recovered: ${recoveredAddress}`);
    }

    return isValid;

  } catch (error) {
    logger.error('Error verifying signature:', error);
    return false;
  }
}

/**
 * Generate EIP-712 hash for an order (for frontend signing)
 * @param {Object} orderData - The order data
 * @returns {string} - The EIP-712 hash
 */
function getOrderHash(orderData) {
  try {
    const order = {
      maker: orderData.maker,
      sellToken: orderData.sellToken,
      buyToken: orderData.buyToken,
      sellAmount: orderData.sellAmount.toString(),
      buyAmount: orderData.buyAmount.toString(),
      expiry: orderData.expiry.toString(),
      nonce: orderData.nonce.toString(),
      chainId: orderData.chainId.toString()
    };

    const typedData = {
      domain: DOMAIN,
      types: ORDER_TYPE,
      primaryType: 'Order',
      message: order
    };

    return ethers.TypedDataEncoder.hash(
      typedData.domain,
      typedData.types,
      typedData.message
    );

  } catch (error) {
    logger.error('Error generating order hash:', error);
    throw error;
  }
}

/**
 * Get the typed data structure for frontend signing
 * @param {Object} orderData - The order data
 * @returns {Object} - The EIP-712 typed data
 */
function getTypedDataForSigning(orderData) {
  const order = {
    maker: orderData.maker,
    sellToken: orderData.sellToken,
    buyToken: orderData.buyToken,
    sellAmount: orderData.sellAmount.toString(),
    buyAmount: orderData.buyAmount.toString(),
    expiry: orderData.expiry.toString(),
    nonce: orderData.nonce.toString(),
    chainId: orderData.chainId.toString()
  };

  return {
    domain: DOMAIN,
    types: ORDER_TYPE,
    primaryType: 'Order',
    message: order
  };
}

module.exports = {
  verifyOrderSignature,
  getOrderHash,
  getTypedDataForSigning,
  DOMAIN,
  ORDER_TYPE
}; 