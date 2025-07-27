const { ethers } = require('ethers');

// Chain configurations
const CHAINS = {
  1: {
    name: 'Ethereum',
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    currency: 'ETH',
    blockExplorer: 'https://etherscan.io',
    chainId: 1
  },
  137: {
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL,
    currency: 'MATIC',
    blockExplorer: 'https://polygonscan.com',
    chainId: 137
  },
  42161: {
    name: 'Arbitrum',
    rpcUrl: process.env.ARBITRUM_RPC_URL,
    currency: 'ETH',
    blockExplorer: 'https://arbiscan.io',
    chainId: 42161
  },
  31337: {
    name: 'Localhost',
    rpcUrl: 'http://127.0.0.1:8545',
    currency: 'ETH',
    blockExplorer: null,
    chainId: 31337
  }
};

// Create providers for each chain
const providers = {};
const relayerWallets = {};

function initializeProviders() {
  Object.keys(CHAINS).forEach(chainId => {
    const chain = CHAINS[chainId];
    if (chain.rpcUrl) {
      try {
        // Create provider
        providers[chainId] = new ethers.JsonRpcProvider(chain.rpcUrl);
        
        // Create relayer wallet if private key is provided
        if (process.env.RELAYER_PRIVATE_KEY) {
          relayerWallets[chainId] = new ethers.Wallet(
            process.env.RELAYER_PRIVATE_KEY,
            providers[chainId]
          );
          console.log(`Relayer wallet initialized for ${chain.name}: ${relayerWallets[chainId].address}`);
        }
        
        console.log(`Provider initialized for ${chain.name} (Chain ID: ${chainId})`);
      } catch (error) {
        console.error(`Failed to initialize provider for ${chain.name}:`, error.message);
      }
    }
  });
}

// Smart contract addresses (to be populated after deployment)
const CONTRACTS = {
  1: {
    CROSSLINE_CORE: process.env.CROSSLINE_CORE_ETHEREUM,
    LAYERZERO_ENDPOINT: '0x66A71Dcef29A0fFBDBE3c6a460a3B5BC225Cd675',
    AXELAR_GATEWAY: '0x4F4495243837681061C4743b74B3eEdf548D56A5'
  },
  137: {
    CROSSLINE_CORE: process.env.CROSSLINE_CORE_POLYGON,
    LAYERZERO_ENDPOINT: '0x3c2269811836af69497E5F486A85D7316753cf62',
    AXELAR_GATEWAY: '0x6f015F16De9fC8791b234eF68D486d2bF203FBA8'
  },
  42161: {
    CROSSLINE_CORE: process.env.CROSSLINE_CORE_ARBITRUM,
    LAYERZERO_ENDPOINT: '0x3c2269811836af69497E5F486A85D7316753cf62',
    AXELAR_GATEWAY: '0xe432150cce91c13a887f7D836923d5597adD8E31'
  },
  31337: {
    CROSSLINE_CORE: null, // Will be set during local deployment
    LAYERZERO_ENDPOINT: null,
    AXELAR_GATEWAY: null
  }
};

// Common token addresses
const TOKENS = {
  1: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86a33E6441E94934E0b41d9d0A1E0b0000000', // Example
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  },
  137: {
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063'
  },
  42161: {
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1'
  }
};

// Utility functions
const getProvider = (chainId) => {
  return providers[chainId];
};

const getRelayerWallet = (chainId) => {
  return relayerWallets[chainId];
};

const getChainConfig = (chainId) => {
  return CHAINS[chainId];
};

const getContractAddress = (chainId, contractName) => {
  return CONTRACTS[chainId]?.[contractName];
};

const getTokenAddress = (chainId, tokenSymbol) => {
  return TOKENS[chainId]?.[tokenSymbol];
};

const isValidChain = (chainId) => {
  return chainId in CHAINS;
};

const getSupportedChains = () => {
  return Object.keys(CHAINS).map(Number);
};

// EIP-712 Domain for signature verification
const getEIP712Domain = (chainId) => {
  return {
    name: 'Crossline',
    version: '1',
    chainId: chainId,
    verifyingContract: getContractAddress(chainId, 'CROSSLINE_CORE') || '0x0000000000000000000000000000000000000000'
  };
};

// Order type for EIP-712 signatures
const ORDER_TYPES = {
  Order: [
    { name: 'userAddress', type: 'address' },
    { name: 'sellToken', type: 'address' },
    { name: 'buyToken', type: 'address' },
    { name: 'sellAmount', type: 'uint256' },
    { name: 'buyAmount', type: 'uint256' },
    { name: 'sourceChain', type: 'uint256' },
    { name: 'targetChain', type: 'uint256' },
    { name: 'expiryTime', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
};

module.exports = {
  CHAINS,
  CONTRACTS,
  TOKENS,
  ORDER_TYPES,
  initializeProviders,
  getProvider,
  getRelayerWallet,
  getChainConfig,
  getContractAddress,
  getTokenAddress,
  isValidChain,
  getSupportedChains,
  getEIP712Domain
}; 