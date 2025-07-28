const { ethers } = require('ethers');
const Match = require('../models/Match');
const Order = require('../models/Order');
const logger = require('../utils/logger');

// Network configurations
const NETWORKS = {
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'http://localhost:8545',
    chainId: 1
  },
  polygon: {
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    chainId: 137
  },
  arbitrum: {
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    chainId: 42161
  },
  localhost: {
    rpcUrl: 'http://localhost:8545',
    chainId: 31337
  }
};

// Mock contract addresses (will be replaced with real deployed contracts)
const CONTRACT_ADDRESSES = {
  ethereum: process.env.CROSSLINE_CONTRACT_ETHEREUM || '0x0000000000000000000000000000000000000000',
  polygon: process.env.CROSSLINE_CONTRACT_POLYGON || '0x0000000000000000000000000000000000000000',
  arbitrum: process.env.CROSSLINE_CONTRACT_ARBITRUM || '0x0000000000000000000000000000000000000000',
  localhost: process.env.CROSSLINE_CONTRACT_LOCALHOST || '0x0000000000000000000000000000000000000000'
};

// Simple ERC20 ABI for token transfers
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)'
];

// Mock Crossline contract ABI (simplified for demo)
const CROSSLINE_ABI = [
  'function executeMatch(bytes32 matchId, address buyToken, address sellToken, uint256 buyAmount, uint256 sellAmount, address buyer, address seller) external returns (bool)',
  'function getMatchStatus(bytes32 matchId) external view returns (uint8)',
  'event MatchExecuted(bytes32 indexed matchId, address indexed buyer, address indexed seller, uint256 amount)'
];

class TradeExecutor {
  constructor() {
    this.providers = {};
    this.relayerWallets = {};
    this.isInitialized = false;
  }

  /**
   * Initialize the trade executor with network providers and relayer wallets
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      const relayerPrivateKey = process.env.RELAYER_PRIVATE_KEY;
      if (!relayerPrivateKey) {
        logger.warn('No relayer private key provided, using mock execution');
        this.isInitialized = true;
        return;
      }

      // Initialize providers and wallets for each network
      for (const [network, config] of Object.entries(NETWORKS)) {
        try {
          this.providers[network] = new ethers.JsonRpcProvider(config.rpcUrl);
          this.relayerWallets[network] = new ethers.Wallet(relayerPrivateKey, this.providers[network]);
          
          logger.info(`✅ Initialized ${network} trade executor`);
        } catch (error) {
          logger.error(`Failed to initialize ${network} trade executor:`, error);
        }
      }

      this.isInitialized = true;
      logger.info('🔗 Trade executor initialized');

    } catch (error) {
      logger.error('Failed to initialize trade executor:', error);
      throw error;
    }
  }

  /**
   * Execute a match onchain
   * @param {Object} match - Match object from database
   */
  async executeMatch(match) {
    try {
      await this.initialize();

      logger.info(`🔄 Executing match ${match._id} on ${match.executionChain}`);

      // For demo purposes, we'll simulate execution
      if (!this.isInitialized || !this.relayerWallets[match.executionChain]) {
        return await this.simulateExecution(match);
      }

      // Get match details
      await match.populate('buyOrderId sellOrderId');
      const buyOrder = match.buyOrderId;
      const sellOrder = match.sellOrderId;

      // Verify match can still be executed
      if (!match.canBeExecuted()) {
        throw new Error('Match cannot be executed (expired or invalid status)');
      }

      // Execute the trade
      const txHash = await this.executeOnchain(match, buyOrder, sellOrder);

      // Update match status
      await match.markAsExecuted(txHash, '21000', '20000000000'); // Mock gas values

      // Update order statuses
      await this.updateOrdersAfterExecution(buyOrder, sellOrder, match);

      logger.info(`✅ Match executed successfully: ${txHash}`);
      return { success: true, txHash };

    } catch (error) {
      logger.error(`❌ Failed to execute match ${match._id}:`, error);
      
      // Mark match as failed
      await match.markAsFailed(error.message);
      
      throw error;
    }
  }

  /**
   * Execute trade onchain (simplified for demo)
   */
  async executeOnchain(match, buyOrder, sellOrder) {
    const network = match.executionChain;
    const provider = this.providers[network];
    const relayerWallet = this.relayerWallets[network];

    if (!provider || !relayerWallet) {
      throw new Error(`No provider or wallet for ${network}`);
    }

    try {
      // In a real implementation, this would:
      // 1. Create Crossline contract instance
      // 2. Verify token allowances
      // 3. Execute atomic swap
      // 4. Handle cross-chain bridging if needed

      // For demo, we'll create a mock transaction
      const mockTx = {
        to: CONTRACT_ADDRESSES[network],
        value: 0,
        gasLimit: 100000,
        gasPrice: ethers.parseUnits('20', 'gwei'),
        data: '0x' + Buffer.from(`executeMatch(${match._id})`).toString('hex')
      };

      // Simulate transaction
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay
      
      // Generate mock transaction hash
      const mockTxHash = ethers.keccak256(
        ethers.toUtf8Bytes(`${match._id}-${Date.now()}`)
      );

      return mockTxHash;

    } catch (error) {
      logger.error('Onchain execution error:', error);
      throw error;
    }
  }

  /**
   * Simulate execution for demo purposes
   */
  async simulateExecution(match) {
    logger.info(`🎭 Simulating execution for match ${match._id}`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error('Simulated execution failure');
    }

    // Generate mock transaction hash
    const mockTxHash = ethers.keccak256(
      ethers.toUtf8Bytes(`mock-${match._id}-${Date.now()}`)
    );

    // Update match status
    await match.markAsExecuted(mockTxHash, '21000', '20000000000');

    // Update orders
    await match.populate('buyOrderId sellOrderId');
    await this.updateOrdersAfterExecution(match.buyOrderId, match.sellOrderId, match);

    logger.info(`✅ Mock execution completed: ${mockTxHash}`);
    return { success: true, txHash: mockTxHash };
  }

  /**
   * Update order statuses after successful execution
   */
  async updateOrdersAfterExecution(buyOrder, sellOrder, match) {
    try {
      // Update buy order
      if (buyOrder.remainingAmount === '0') {
        buyOrder.orderStatus = 'filled';
      }
      buyOrder.executionTxHash = match.executionTxHash;
      buyOrder.executedAt = match.executedAt;
      await buyOrder.save();

      // Update sell order
      if (sellOrder.remainingAmount === '0') {
        sellOrder.orderStatus = 'filled';
      }
      sellOrder.executionTxHash = match.executionTxHash;
      sellOrder.executedAt = match.executedAt;
      await sellOrder.save();

      logger.info(`📝 Updated order statuses for match ${match._id}`);

    } catch (error) {
      logger.error('Error updating orders after execution:', error);
      throw error;
    }
  }

  /**
   * Execute cross-chain trade (future implementation)
   */
  async executeCrossChain(match, buyOrder, sellOrder) {
    logger.info(`🌉 Cross-chain execution not yet implemented for match ${match._id}`);
    
    // Placeholder for cross-chain execution logic
    // This would integrate with LayerZero, Axelar, etc.
    
    throw new Error('Cross-chain execution not yet implemented');
  }

  /**
   * Check if a match can be executed
   */
  async canExecuteMatch(matchId) {
    try {
      const match = await Match.findById(matchId);
      if (!match) return false;

      return match.canBeExecuted();

    } catch (error) {
      logger.error('Error checking match executability:', error);
      return false;
    }
  }

  /**
   * Get execution status for a match
   */
  async getExecutionStatus(matchId) {
    try {
      const match = await Match.findById(matchId)
        .populate('buyOrderId sellOrderId');

      if (!match) {
        return { status: 'not_found' };
      }

      return {
        status: match.matchStatus,
        txHash: match.executionTxHash,
        executedAt: match.executedAt,
        gasUsed: match.gasUsed,
        gasPrice: match.gasPrice,
        errorMessage: match.errorMessage
      };

    } catch (error) {
      logger.error('Error getting execution status:', error);
      return { status: 'error', error: error.message };
    }
  }
}

// Export singleton instance
const tradeExecutor = new TradeExecutor();

/**
 * Main execution function
 */
async function executeMatch(match) {
  return await tradeExecutor.executeMatch(match);
}

/**
 * Initialize the trade executor
 */
async function initializeTradeExecutor() {
  return await tradeExecutor.initialize();
}

module.exports = {
  TradeExecutor,
  executeMatch,
  initializeTradeExecutor,
  tradeExecutor
}; 