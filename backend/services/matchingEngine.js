const cron = require('node-cron');
const Order = require('../models/Order');
const Match = require('../models/Match');
const { getStorage, useInMemory } = require('../config/database');
const logger = require('../utils/logger');
const { executeMatch } = require('./tradeExecutor');

class MatchingEngine {
  constructor(io) {
    this.io = io;
    this.matchingInterval = process.env.MATCHING_INTERVAL_SECONDS || 5; // Every 5 seconds for production
    this.cronJob = null;
    this.isRunning = false;
    this.matchingStats = {
      totalMatches: 0,
      totalVolume: '0',
      lastMatchTime: null,
      cyclesRun: 0
    };
  }

  /**
   * Start the matching engine
   */
  async start() {
    if (this.isRunning) {
      logger.warn('⚠️ Matching engine already running');
      return;
    }

    logger.info('🚀 Starting Crossline Production Matching Engine');
    this.isRunning = true;

    // Run matching every interval
    this.matchingInterval = setInterval(() => {
      this.runMatchingCycle().catch(error => {
        logger.error('❌ Error in matching cycle:', error);
      });
    }, this.matchingInterval * 1000);

    // Schedule cleanup tasks
    this.scheduleCleanupTasks();

    // Run initial matching cycle
    await this.runMatchingCycle();
    
    logger.info(`✅ Production matching engine started (${this.matchingInterval}s intervals)`);
  }

  /**
   * Stop the matching engine
   */
  stop() {
    if (this.matchingInterval) {
      clearInterval(this.matchingInterval);
      this.matchingInterval = null;
    }
    
    if (this.cronJob) {
      this.cronJob.destroy();
      this.cronJob = null;
    }
    
    this.isRunning = false;
    logger.info('🛑 Matching engine stopped');
  }

  /**
   * Main matching cycle - finds and processes matches
   */
  async runMatchingCycle() {
    try {
      const startTime = Date.now();
      logger.debug('🔄 Running production matching cycle...');
      this.matchingStats.cyclesRun++;

      let totalMatches = 0;
      const storage = getStorage();

      if (storage.type === 'in-memory') {
        totalMatches = await this.matchOrdersInMemory(storage);
      } else {
        totalMatches = await this.matchOrdersMongoDB();
      }

      const duration = Date.now() - startTime;
      
      if (totalMatches > 0) {
        this.matchingStats.totalMatches += totalMatches;
        this.matchingStats.lastMatchTime = new Date();
        
        logger.info(`🎉 Matching cycle completed: ${totalMatches} matches found in ${duration}ms`);
        
        // Emit real-time update
        this.io.emit('matching-update', {
          type: 'matches-found',
          data: {
            matches: totalMatches,
            duration,
            timestamp: new Date()
          }
        });
      } else {
        logger.debug(`✅ Matching cycle completed: No matches found (${duration}ms)`);
      }

    } catch (error) {
      logger.error('❌ Error in matching cycle:', error);
    }
  }

  /**
   * Match orders using in-memory storage
   */
  async matchOrdersInMemory(storage) {
    const orders = Array.from(storage.orders.values());
    const activeOrders = orders.filter(order => 
      order.status === 'active' && 
      new Date(order.expiry) > new Date()
    );

    if (activeOrders.length < 2) {
      return 0;
    }

    let totalMatches = 0;
    const processedOrders = new Set();

    // Group orders by token pairs
    const ordersByPair = this.groupOrdersByTokenPair(activeOrders);

    for (const [tokenPair, pairOrders] of Object.entries(ordersByPair)) {
      const matches = await this.findMatchesForPair(pairOrders);
      
      for (const match of matches) {
        if (!processedOrders.has(match.buyOrder.id) && !processedOrders.has(match.sellOrder.id)) {
          await this.processMatch(match, storage);
          processedOrders.add(match.buyOrder.id);
          processedOrders.add(match.sellOrder.id);
          totalMatches++;
        }
      }
    }

    return totalMatches;
  }

  /**
   * Match orders using MongoDB
   */
  async matchOrdersMongoDB() {
    // Get all active token pairs
    const tokenPairs = await Order.distinct('tokenPair', {
      status: 'active',
      expiry: { $gt: new Date() }
    });

    let totalMatches = 0;

    for (const tokenPair of tokenPairs) {
      const orders = await Order.find({
        tokenPair,
        status: 'active',
        expiry: { $gt: new Date() }
      }).sort({ createdAt: 1 });

      if (orders.length < 2) continue;

      const matches = await this.findMatchesForPair(orders);
      
      for (const match of matches) {
        await this.processMatchMongoDB(match);
        totalMatches++;
      }
    }

    return totalMatches;
  }

  /**
   * Group orders by token pair for efficient matching
   */
  groupOrdersByTokenPair(orders) {
    const grouped = {};
    
    for (const order of orders) {
      const pair = order.tokenPair || `${order.sellToken}/${order.buyToken}`;
      if (!grouped[pair]) {
        grouped[pair] = [];
      }
      grouped[pair].push(order);
    }
    
    return grouped;
  }

  /**
   * Find compatible matches for a token pair
   */
  async findMatchesForPair(orders) {
    const matches = [];
    
    // Separate buy and sell orders
    const buyOrders = [];
    const sellOrders = [];
    
    for (const order of orders) {
      // Determine if this is a buy or sell based on token addresses
      const isBuyOrder = this.isBuyOrder(order);
      if (isBuyOrder) {
        buyOrders.push(order);
      } else {
        sellOrders.push(order);
      }
    }

    // Sort orders for optimal matching
    buyOrders.sort((a, b) => parseFloat(b.price) - parseFloat(a.price)); // Highest price first
    sellOrders.sort((a, b) => parseFloat(a.price) - parseFloat(b.price)); // Lowest price first

    // Find matches
    for (const buyOrder of buyOrders) {
      for (const sellOrder of sellOrders) {
        if (this.canMatch(buyOrder, sellOrder)) {
          const matchedAmount = this.calculateMatchedAmount(buyOrder, sellOrder);
          
          if (BigInt(matchedAmount) > 0) {
            matches.push({
              buyOrder,
              sellOrder,
              matchedAmount,
              price: sellOrder.price, // Execute at sell order price
              timestamp: new Date()
            });
            
            // Update remaining amounts (for this cycle)
            buyOrder.remainingAmount = (BigInt(buyOrder.remainingAmount || buyOrder.sellAmount) - BigInt(matchedAmount)).toString();
            sellOrder.remainingAmount = (BigInt(sellOrder.remainingAmount || sellOrder.sellAmount) - BigInt(matchedAmount)).toString();
            
            // If order is fully filled, don't match it again
            if (BigInt(buyOrder.remainingAmount) <= 0) break;
          }
        }
      }
    }

    return matches;
  }

  /**
   * Determine if an order is a buy order
   */
  isBuyOrder(order) {
    // If selling USDC/stablecoin for ETH/WETH, it's a buy order
    const stablecoins = ['USDC', 'USDT', 'DAI'];
    const sellTokenSymbol = this.getTokenSymbol(order.sellToken);
    const buyTokenSymbol = this.getTokenSymbol(order.buyToken);
    
    return stablecoins.includes(sellTokenSymbol) && !stablecoins.includes(buyTokenSymbol);
  }

  /**
   * Get token symbol from address (simplified)
   */
  getTokenSymbol(address) {
    const tokenMap = {
      '0x54EcCfc920a98f97cb2a3b375e6e4cd119e705bC': 'USDC',
      '0xA895E03B50672Bb7e23e33875D9d3223A04074BF': 'WETH',
      '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238': 'USDC',
      '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14': 'WETH'
    };
    return tokenMap[address] || 'UNKNOWN';
  }

  /**
   * Check if two orders can be matched
   */
  canMatch(buyOrder, sellOrder) {
    // Basic compatibility checks
    if (buyOrder.id === sellOrder.id) return false;
    if (buyOrder.maker.toLowerCase() === sellOrder.maker.toLowerCase()) return false;
    
    // Token compatibility (buy order's buyToken should match sell order's sellToken)
    if (buyOrder.buyToken.toLowerCase() !== sellOrder.sellToken.toLowerCase()) return false;
    if (buyOrder.sellToken.toLowerCase() !== sellOrder.buyToken.toLowerCase()) return false;
    
    // Price compatibility (buy price >= sell price)
    return parseFloat(buyOrder.price) >= parseFloat(sellOrder.price);
  }

  /**
   * Calculate the matched amount between two orders
   */
  calculateMatchedAmount(buyOrder, sellOrder) {
    const buyRemaining = BigInt(buyOrder.remainingAmount || buyOrder.sellAmount);
    const sellRemaining = BigInt(sellOrder.remainingAmount || sellOrder.sellAmount);
    
    // Match the minimum of what's available
    return buyRemaining < sellRemaining ? buyRemaining.toString() : sellRemaining.toString();
  }

  /**
   * Process a match in in-memory storage
   */
  async processMatch(match, storage) {
    try {
      // Update order statuses
      const buyOrder = storage.orders.get(match.buyOrder.id);
      const sellOrder = storage.orders.get(match.sellOrder.id);
      
      if (!buyOrder || !sellOrder) return;

      // Update filled amounts
      buyOrder.filledAmount = (BigInt(buyOrder.filledAmount || '0') + BigInt(match.matchedAmount)).toString();
      sellOrder.filledAmount = (BigInt(sellOrder.filledAmount || '0') + BigInt(match.matchedAmount)).toString();
      
      // Update remaining amounts
      buyOrder.remainingAmount = (BigInt(buyOrder.sellAmount) - BigInt(buyOrder.filledAmount)).toString();
      sellOrder.remainingAmount = (BigInt(sellOrder.sellAmount) - BigInt(sellOrder.filledAmount)).toString();
      
      // Check if orders are fully filled
      if (BigInt(buyOrder.remainingAmount) <= 0) {
        buyOrder.status = 'filled';
        buyOrder.executedAt = new Date().toISOString();
      }
      
      if (BigInt(sellOrder.remainingAmount) <= 0) {
        sellOrder.status = 'filled';
        sellOrder.executedAt = new Date().toISOString();
      }

      // Store the match
      const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      storage.matches.set(matchId, {
        id: matchId,
        buyOrderId: match.buyOrder.id,
        sellOrderId: match.sellOrder.id,
        buyOrderMaker: match.buyOrder.maker,
        sellOrderMaker: match.sellOrder.maker,
        matchedAmount: match.matchedAmount,
        price: match.price,
        sellToken: match.sellOrder.sellToken,
        buyToken: match.sellOrder.buyToken,
        executedAt: match.timestamp,
        status: 'completed'
      });

      logger.info(`✅ Match processed: ${match.matchedAmount} tokens between ${buyOrder.maker} and ${sellOrder.maker}`);

      // Emit real-time updates
      this.io.emit('order-updated', { type: 'order-filled', data: buyOrder });
      this.io.emit('order-updated', { type: 'order-filled', data: sellOrder });
      this.io.emit('match-executed', { type: 'match-executed', data: storage.matches.get(matchId) });

    } catch (error) {
      logger.error('❌ Error processing match:', error);
    }
  }

  /**
   * Process a match in MongoDB
   */
  async processMatchMongoDB(match) {
    try {
      // Update orders
      await match.buyOrder.fill(match.matchedAmount);
      await match.sellOrder.fill(match.matchedAmount);

      // Create match record
      const matchRecord = new Match({
        buyOrderId: match.buyOrder._id,
        sellOrderId: match.sellOrder._id,
        buyOrderMaker: match.buyOrder.maker,
        sellOrderMaker: match.sellOrder.maker,
        matchedAmount: match.matchedAmount,
        price: match.price,
        sellToken: match.sellOrder.sellToken,
        buyToken: match.sellOrder.buyToken,
        executedAt: match.timestamp,
        status: 'completed'
      });

      await matchRecord.save();

      logger.info(`✅ Match processed: ${match.matchedAmount} tokens between ${match.buyOrder.maker} and ${match.sellOrder.maker}`);

      // Emit real-time updates
      this.io.emit('order-updated', { type: 'order-filled', data: match.buyOrder });
      this.io.emit('order-updated', { type: 'order-filled', data: match.sellOrder });
      this.io.emit('match-executed', { type: 'match-executed', data: matchRecord });

    } catch (error) {
      logger.error('❌ Error processing MongoDB match:', error);
    }
  }

  /**
   * Schedule cleanup tasks
   */
  scheduleCleanupTasks() {
    // Clean up expired orders every hour
    this.cronJob = cron.schedule('0 * * * *', async () => {
      try {
        await this.cleanupExpiredOrders();
      } catch (error) {
        logger.error('❌ Error in cleanup task:', error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    logger.info('📅 Cleanup tasks scheduled');
  }

  /**
   * Clean up expired orders
   */
  async cleanupExpiredOrders() {
    try {
      const storage = getStorage();
      let expiredCount = 0;

      if (storage.type === 'in-memory') {
        const now = new Date();
        for (const [orderId, order] of storage.orders) {
          if (new Date(order.expiry) <= now && order.status === 'active') {
            order.status = 'expired';
            expiredCount++;
          }
        }
      } else {
        const result = await Order.updateMany(
          { expiry: { $lte: new Date() }, status: 'active' },
          { status: 'expired' }
        );
        expiredCount = result.modifiedCount;
      }

      if (expiredCount > 0) {
        logger.info(`🧹 Cleaned up ${expiredCount} expired orders`);
      }

    } catch (error) {
      logger.error('❌ Error cleaning up expired orders:', error);
    }
  }

  /**
   * Get matching engine statistics
   */
  getStats() {
    return {
      ...this.matchingStats,
      isRunning: this.isRunning,
      interval: this.matchingInterval
    };
  }
}

module.exports = MatchingEngine; 