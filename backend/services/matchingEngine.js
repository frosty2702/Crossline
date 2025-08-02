const cron = require('node-cron');
// For demo mode, we'll use in-memory storage instead of MongoDB models
const { db } = require('../config/database');
const logger = require('../utils/logger');
const { executeMatch } = require('./tradeExecutor');

class MatchingEngine {
  constructor(io) {
    this.io = io;
    this.isRunning = false;
    this.matchingInterval = null;
  }

  /**
   * Start the matching engine
   */
  async start() {
    if (this.isRunning) {
      logger.warn('Matching engine is already running');
      return;
    }

    this.isRunning = true;
    logger.info('🔄 Starting Crossline Matching Engine');

    // Run matching every 10 seconds
    this.matchingInterval = setInterval(() => {
      this.runMatchingCycle().catch(error => {
        logger.error('Error in matching cycle:', error);
      });
    }, 10000);

    // Also schedule cleanup tasks
    this.scheduleCleanupTasks();

    // Run initial matching cycle
    await this.runMatchingCycle();
  }

  /**
   * Stop the matching engine
   */
  stop() {
    if (this.matchingInterval) {
      clearInterval(this.matchingInterval);
      this.matchingInterval = null;
    }
    this.isRunning = false;
    logger.info('🛑 Matching engine stopped');
  }

  /**
   * Main matching cycle - finds and processes matches
   */
  async runMatchingCycle() {
    try {
      logger.debug('Running matching cycle...');

      // For demo mode, just log that matching is running
      logger.info('Matching engine running in demo mode - no active orders to process');
      let totalMatches = 0;

      if (totalMatches > 0) {
        logger.info(`✅ Matching cycle completed: ${totalMatches} matches found`);
      }

    } catch (error) {
      logger.error('Error in matching cycle:', error);
    }
  }

  /**
   * Find matches for a specific token pair
   * @param {string} tokenPair - Token pair to match (e.g., "WETH-USDC")
   */
  async findMatchesForPair(tokenPair) {
    try {
      // Get open buy orders (highest price first)
      const buyOrders = await Order.find({
        tokenPair,
        orderType: 'buy',
        orderStatus: 'open',
        expiry: { $gt: new Date() }
      }).sort({ price: -1, createdAt: 1 }); // Price-time priority

      // Get open sell orders (lowest price first)
      const sellOrders = await Order.find({
        tokenPair,
        orderType: 'sell',
        orderStatus: 'open',
        expiry: { $gt: new Date() }
      }).sort({ price: 1, createdAt: 1 }); // Price-time priority

      if (buyOrders.length === 0 || sellOrders.length === 0) {
        return 0;
      }

      let matchCount = 0;

      // Try to match orders
      for (const buyOrder of buyOrders) {
        for (const sellOrder of sellOrders) {
          // Check if orders can be matched
          if (this.canMatch(buyOrder, sellOrder)) {
            await this.createMatch(buyOrder, sellOrder);
            matchCount++;
            
            // Break if buy order is fully filled
            if (buyOrder.orderStatus === 'filled') {
              break;
            }
          }
        }
      }

      return matchCount;

    } catch (error) {
      logger.error(`Error finding matches for ${tokenPair}:`, error);
      return 0;
    }
  }

  /**
   * Check if two orders can be matched
   * @param {Object} buyOrder - Buy order
   * @param {Object} sellOrder - Sell order
   */
  canMatch(buyOrder, sellOrder) {
    // Basic checks
    if (buyOrder.userAddress === sellOrder.userAddress) {
      return false; // Can't match with self
    }

    if (buyOrder.tokenPair !== sellOrder.tokenPair) {
      return false; // Different pairs
    }

    if (!buyOrder.canBeMatched() || !sellOrder.canBeMatched()) {
      return false; // Orders not matchable
    }

    // Price check: buy price >= sell price
    return buyOrder.price >= sellOrder.price;
  }

  /**
   * Create a match between two orders
   * @param {Object} buyOrder - Buy order
   * @param {Object} sellOrder - Sell order
   */
  async createMatch(buyOrder, sellOrder) {
    try {
      // Calculate match details
      const matchDetails = this.calculateMatchDetails(buyOrder, sellOrder);

      // Create match record
      const match = new Match({
        buyOrderId: buyOrder._id,
        sellOrderId: sellOrder._id,
        tokenPair: buyOrder.tokenPair,
        matchedPrice: matchDetails.price,
        matchedAmount: matchDetails.amount,
        buyAmount: matchDetails.buyAmount,
        buyerAddress: buyOrder.userAddress,
        sellerAddress: sellOrder.userAddress,
        executionChain: this.selectExecutionChain(buyOrder, sellOrder),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes to execute
        crossChainDetails: this.getCrossChainDetails(buyOrder, sellOrder)
      });

      await match.save();

      // Update order statuses
      await this.updateOrdersAfterMatch(buyOrder, sellOrder, matchDetails);

      // Emit real-time events
      this.emitMatchEvents(match, buyOrder, sellOrder);

      // Queue for execution
      await this.queueForExecution(match);

      logger.info(`💰 Match created: ${match._id} for ${buyOrder.tokenPair} at price ${matchDetails.price}`);

    } catch (error) {
      logger.error('Error creating match:', error);
      throw error;
    }
  }

  /**
   * Calculate match details (price, amount, etc.)
   * @param {Object} buyOrder - Buy order
   * @param {Object} sellOrder - Sell order
   */
  calculateMatchDetails(buyOrder, sellOrder) {
    // Use sell order price (maker price)
    const price = sellOrder.price;
    
    // Calculate maximum matchable amount
    const buyRemaining = BigInt(buyOrder.remainingAmount);
    const sellRemaining = BigInt(sellOrder.remainingAmount);
    
    // Amount is limited by both orders
    const matchedAmount = buyRemaining < sellRemaining ? buyRemaining : sellRemaining;
    
    // Calculate buy amount based on matched sell amount and price
    const buyAmount = (BigInt(matchedAmount) * BigInt(Math.floor(price * 1e18))) / BigInt(1e18);

    return {
      price,
      amount: matchedAmount.toString(),
      buyAmount: buyAmount.toString()
    };
  }

  /**
   * Update order statuses after a match
   */
  async updateOrdersAfterMatch(buyOrder, sellOrder, matchDetails) {
    const matchedAmount = BigInt(matchDetails.amount);

    // Update buy order
    const buyRemaining = BigInt(buyOrder.remainingAmount) - matchedAmount;
    buyOrder.remainingAmount = buyRemaining.toString();
    buyOrder.filledAmount = (BigInt(buyOrder.filledAmount) + matchedAmount).toString();
    
    if (buyRemaining === 0n) {
      buyOrder.orderStatus = 'filled';
    } else {
      buyOrder.orderStatus = 'partially_filled';
    }

    buyOrder.matchedWith.push({
      orderId: sellOrder._id,
      matchedAmount: matchDetails.amount,
      matchedAt: new Date()
    });

    await buyOrder.save();

    // Update sell order
    const sellRemaining = BigInt(sellOrder.remainingAmount) - matchedAmount;
    sellOrder.remainingAmount = sellRemaining.toString();
    sellOrder.filledAmount = (BigInt(sellOrder.filledAmount) + matchedAmount).toString();
    
    if (sellRemaining === 0n) {
      sellOrder.orderStatus = 'filled';
    } else {
      sellOrder.orderStatus = 'partially_filled';
    }

    sellOrder.matchedWith.push({
      orderId: buyOrder._id,
      matchedAmount: matchDetails.amount,
      matchedAt: new Date()
    });

    await sellOrder.save();
  }

  /**
   * Select execution chain for the match
   */
  selectExecutionChain(buyOrder, sellOrder) {
    // If both orders are on same chain, execute there
    if (buyOrder.sourceChain === sellOrder.sourceChain) {
      return buyOrder.sourceChain;
    }

    // Otherwise, use target chain or default to ethereum
    return buyOrder.targetChain || sellOrder.targetChain || 'ethereum';
  }

  /**
   * Get cross-chain details if applicable
   */
  getCrossChainDetails(buyOrder, sellOrder) {
    if (buyOrder.sourceChain !== sellOrder.sourceChain ||
        buyOrder.targetChain !== sellOrder.targetChain) {
      return {
        sourceChain: buyOrder.sourceChain,
        targetChain: sellOrder.sourceChain,
        bridgeStatus: 'pending'
      };
    }
    return null;
  }

  /**
   * Emit real-time events for matches
   */
  emitMatchEvents(match, buyOrder, sellOrder) {
    // Emit to orderbook subscribers
    this.io.to(`orderbook:${match.tokenPair}`).emit('match-found', {
      type: 'match-found',
      data: {
        matchId: match._id,
        tokenPair: match.tokenPair,
        price: match.matchedPrice,
        amount: match.matchedAmount,
        timestamp: match.matchedAt
      }
    });

    // Emit to user subscribers
    this.io.to(`trades:${buyOrder.userAddress}`).emit('order-matched', {
      type: 'order-matched',
      data: {
        orderId: buyOrder._id,
        matchId: match._id,
        side: 'buy'
      }
    });

    this.io.to(`trades:${sellOrder.userAddress}`).emit('order-matched', {
      type: 'order-matched',
      data: {
        orderId: sellOrder._id,
        matchId: match._id,
        side: 'sell'
      }
    });
  }

  /**
   * Queue match for execution
   */
  async queueForExecution(match) {
    try {
      // Mark as verified (basic verification passed)
      match.matchStatus = 'verified';
      await match.save();

      // Execute immediately for demo purposes
      // In production, this would go through a proper queue
      setImmediate(async () => {
        try {
          await executeMatch(match);
        } catch (error) {
          logger.error(`Error executing match ${match._id}:`, error);
          await match.markAsFailed(error.message);
        }
      });

    } catch (error) {
      logger.error('Error queuing match for execution:', error);
    }
  }

  /**
   * Schedule cleanup tasks
   */
  scheduleCleanupTasks() {
    // Clean expired orders every hour
    cron.schedule('0 * * * *', async () => {
      try {
        const expiredCount = await Order.updateMany(
          {
            orderStatus: 'open',
            expiry: { $lt: new Date() }
          },
          {
            orderStatus: 'expired'
          }
        );

        if (expiredCount.modifiedCount > 0) {
          logger.info(`🧹 Cleaned up ${expiredCount.modifiedCount} expired orders`);
        }
      } catch (error) {
        logger.error('Error cleaning expired orders:', error);
      }
    });

    // Clean expired matches every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      try {
        const expiredMatches = await Match.updateMany(
          {
            matchStatus: { $in: ['pending', 'verified'] },
            expiresAt: { $lt: new Date() }
          },
          {
            matchStatus: 'expired'
          }
        );

        if (expiredMatches.modifiedCount > 0) {
          logger.info(`🧹 Cleaned up ${expiredMatches.modifiedCount} expired matches`);
        }
      } catch (error) {
        logger.error('Error cleaning expired matches:', error);
      }
    });
  }
}

// Export functions
let matchingEngineInstance = null;

async function startMatchingEngine(io) {
  if (!matchingEngineInstance) {
    matchingEngineInstance = new MatchingEngine(io);
  }
  await matchingEngineInstance.start();
}

function stopMatchingEngine() {
  if (matchingEngineInstance) {
    matchingEngineInstance.stop();
  }
}

module.exports = {
  MatchingEngine,
  startMatchingEngine,
  stopMatchingEngine
}; 