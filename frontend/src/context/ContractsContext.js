import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAccount, useNetwork } from 'wagmi';
import { ethers } from 'ethers';

const ContractsContext = createContext();

export const useContracts = () => {
  const context = useContext(ContractsContext);
  if (!context) {
    throw new Error('useContracts must be used within a ContractsProvider');
  }
  return context;
};

// Contract addresses for different networks
const CONTRACT_ADDRESSES = {
  31337: { // Hardhat/Localhost
    CrosslineCore: process.env.REACT_APP_CROSSLINE_CORE_LOCALHOST,
    TokenHandler: process.env.REACT_APP_TOKEN_HANDLER_LOCALHOST,
    WETH: process.env.REACT_APP_WETH_LOCALHOST,
    USDC: process.env.REACT_APP_USDC_LOCALHOST,
    WBTC: process.env.REACT_APP_WBTC_LOCALHOST,
  },
  11155111: { // Sepolia
    CrosslineCore: process.env.REACT_APP_CROSSLINE_CORE_SEPOLIA,
    TokenHandler: process.env.REACT_APP_TOKEN_HANDLER_SEPOLIA,
    WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    WBTC: '0x29f2D40B0605204364af54EC677bD022dA425d03',
  },
  137: { // Polygon
    CrosslineCore: process.env.REACT_APP_CROSSLINE_CORE_POLYGON,
    TokenHandler: process.env.REACT_APP_TOKEN_HANDLER_POLYGON,
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
  },
  42161: { // Arbitrum
    CrosslineCore: process.env.REACT_APP_CROSSLINE_CORE_ARBITRUM,
    TokenHandler: process.env.REACT_APP_TOKEN_HANDLER_ARBITRUM,
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDC: '0xA0b86991c431C0c02E82F3b1fF3C3AAEB1b3bb5Fd',
    WBTC: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  },
};

// Native token address (for ETH)
const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Supported tokens with metadata
const TOKEN_CONFIG = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    address: NATIVE_TOKEN,
  },
  WETH: {
    symbol: 'WETH',
    name: 'Wrapped Ethereum',
    decimals: 18,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  WBTC: {
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
  },
};

// Chain configuration
const CHAIN_CONFIG = {
  31337: { name: 'Localhost', shortName: 'Local' },
  11155111: { name: 'Sepolia', shortName: 'Sepolia' },
  1: { name: 'Ethereum', shortName: 'ETH' },
  137: { name: 'Polygon', shortName: 'MATIC' },
  42161: { name: 'Arbitrum', shortName: 'ARB' },
};

export const ContractsProvider = ({ children }) => {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const [contracts, setContracts] = useState({});
  const [tokens, setTokens] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const initializeContracts = async () => {
      if (!isConnected || !chain?.id || !window.ethereum) {
        return;
      }

      try {
        setLoading(true);
        
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        
        const chainId = chain.id;
        const addresses = CONTRACT_ADDRESSES[chainId];
        
        if (!addresses) {
          console.warn(`No contract addresses configured for chain ${chainId}`);
          return;
        }

        // Initialize contracts (simplified ABIs for demo)
        const contractInstances = {};
        
        if (addresses.CrosslineCore) {
          // Simplified ABI - in production, import full ABI
          const crosslineCoreABI = [
            "function executeMatch(tuple(address,address,address,uint256,uint256,uint256,uint256,uint256,uint256),tuple(address,address,address,uint256,uint256,uint256,uint256,uint256,uint256),bytes,bytes,uint256) external returns (bool)",
            "function cancelOrder(bytes32,bytes) external returns (bool)",
            "function isOrderCancelled(bytes32) external view returns (bool)",
            "function isNonceUsed(address,uint256) external view returns (bool)",
            "event MatchExecuted(bytes32 indexed, bytes32 indexed, bytes32 indexed, address, address, address, address, uint256, uint256, uint256)",
            "event OrderCancelled(bytes32 indexed, address indexed, uint256)"
          ];
          
          contractInstances.CrosslineCore = new ethers.Contract(
            addresses.CrosslineCore,
            crosslineCoreABI,
            signer
          );
        }

        if (addresses.TokenHandler) {
          const tokenHandlerABI = [
            "function checkBalance(address,address,uint256) external view returns (bool,uint256)",
            "function checkAllowance(address,address,address,uint256) external view returns (bool,uint256)",
            "function isTokenSupported(address) external view returns (bool)",
            "function validateTransfer(address,address,address,uint256,address) external view returns (bool,string)"
          ];
          
          contractInstances.TokenHandler = new ethers.Contract(
            addresses.TokenHandler,
            tokenHandlerABI,
            signer
          );
        }

        // Initialize token contracts
        const tokenInstances = {};
        const erc20ABI = [
          "function balanceOf(address) external view returns (uint256)",
          "function allowance(address,address) external view returns (uint256)",
          "function approve(address,uint256) external returns (bool)",
          "function transfer(address,uint256) external returns (bool)",
          "function symbol() external view returns (string)",
          "function decimals() external view returns (uint8)",
          "function name() external view returns (string)"
        ];

        Object.entries(TOKEN_CONFIG).forEach(([symbol, config]) => {
          const tokenAddress = symbol === 'ETH' ? NATIVE_TOKEN : addresses[symbol];
          if (tokenAddress && tokenAddress !== NATIVE_TOKEN) {
            tokenInstances[symbol] = {
              contract: new ethers.Contract(tokenAddress, erc20ABI, signer),
              ...config,
              address: tokenAddress
            };
          } else if (symbol === 'ETH') {
            tokenInstances[symbol] = {
              ...config,
              address: NATIVE_TOKEN
            };
          }
        });

        setContracts(contractInstances);
        setTokens(tokenInstances);
        
      } catch (error) {
        console.error('Error initializing contracts:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeContracts();
  }, [isConnected, chain?.id, address]);

  // Helper functions
  const getTokenByAddress = (address) => {
    return Object.values(tokens).find(token => 
      token.address?.toLowerCase() === address?.toLowerCase()
    );
  };

  const getChainInfo = (chainId) => {
    return CHAIN_CONFIG[chainId] || { name: 'Unknown', shortName: 'Unknown' };
  };

  const getSupportedChains = () => {
    return Object.keys(CONTRACT_ADDRESSES).map(chainId => ({
      chainId: parseInt(chainId),
      ...CHAIN_CONFIG[chainId]
    }));
  };

  const isContractSupported = (chainId) => {
    return CONTRACT_ADDRESSES[chainId] !== undefined;
  };

  const value = {
    contracts,
    tokens,
    loading,
    currentChain: chain,
    getTokenByAddress,
    getChainInfo,
    getSupportedChains,
    isContractSupported,
    NATIVE_TOKEN,
    CONTRACT_ADDRESSES,
  };

  return (
    <ContractsContext.Provider value={value}>
      {children}
    </ContractsContext.Provider>
  );
}; 