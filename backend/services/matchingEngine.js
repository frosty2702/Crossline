const cron = require('node-cron');
const { ethers } = require('ethers');

// Models
const Order = require('../models/Order');
const Match = require('../models/Match');

// Config
const { isValidChain } = require('../config/blockchain');

class MatchingEngine {
  constructor(io) {
    this.io = io;
    this.isRunning = false;
    this.matchingInterval = parseInt(process.env.MATCHING_INTERVAL_MS) || 5000;
    this.maxPartialFillPercentage = parseInt(process.env.MAX_PARTIAL_FILL_PERCENTAGE) || 50;
  }

  /**
   * Start the matching engine
   */
  start() {
    if (this.isRunning) {
      console.log('Matching engine is already running');
      return;
    }

    console.log('🔄 Starting Crossline Matching Engine...');
    
    // Run matching every 5 seconds
    this.matchingCron = cron.schedule('*/5 * * * * *', async () => {
      await this.runMatchingCycle();
    }, {
      scheduled: false
    });

    this.matchingCron.start();
    this.isRunning = true;
    
    console.log(`✅ Matching Engine started - Running every ${this.matchingInterval/1000}s`);
  }

  /**
   * Stop the matching engine
   */
  stop() {
    if (!this.isRunning) {
      console.log('Matching engine is not running');
      return;
    }

    if (this.matchingCron) {
      this.matchingCron.stop();
    }
    
    this.isRunning = false;
    console.log('🛑 Matching Engine stopped');
  }

  /**
   * Main matching cycle
   */
  async runMatchingCycle() {
    try {
      console.log('🔍 Running matching cycle...');
      
      // Get all active orders
      const activeOrders = await this.getActiveOrders();
      
      if (activeOrders.length < 2) {
        console.log('⏳ Not enough active orders for matching');
        return;
      }

      // Group orders by token pairs
      const orderGroups = this.groupOrdersByPair(activeOrders);
      
      let totalMatches = 0;
      
      // Process each token pair
      for (const [tokenPair, orders] of Object.entries(orderGroups)) {
        const matches = await this.findMatches(orders, tokenPair);
        totalMatches += matches.length;
      }

      if (totalMatches > 0) {
        console.log(`✅ Matching cycle completed - Found ${totalMatches} matches`);
      } else {
        console.log('⏳ No matches found in this cycle');
      }

    } catch (error) {
      console.error('❌ Error in matching cycle:', error);
    }
  }

  /**
   * Get all active orders that can be matched
   */
  async getActiveOrders() {
    const now = new Date();
    
    return await Order.find({
      orderStatus: { $in: ['open', 'partially_filled'] },
      expiryTime: { $gt: now },
      remainingAmount: { $gt: '0' }
    }).sort({ createdAt: 1 }); // Oldest first for fairness
  }

  /**
   * Group orders by token pairs for efficient matching
   */
  groupOrdersByPair(orders) {
    const groups = {};
    
    orders.forEach(order => {
      const pairKey = `${order.sellToken.symbol}_${order.buyToken.symbol}`;
      if (!groups[pairKey]) {
        groups[pairKey] = [];
      }
      groups[pairKey].push(order);
    });
    
    return groups;
  }

  /**
   * Find matches within a token pair group
   */
  async findMatches(orders, tokenPair) {
    const matches = [];
    const [sellSymbol, buySymbol] = tokenPair.split('_');
    
    // Separate buy and sell orders
    const sellOrders = orders.filter(o => 
      o.sellToken.symbol === sellSymbol && o.buyToken.symbol === buySymbol
    );
    const buyOrders = orders.filter(o => 
      o.sellToken.symbol === buySymbol && o.buyToken.symbol === sellSymbol
    );

    console.log(`🔍 Checking ${sellOrders.length} sell orders vs ${buyOrders.length} buy orders for ${tokenPair}`);

    // Try to match each sell order with compatible buy orders
    for (const sellOrder of sellOrders) {
      for (const buyOrder of buyOrders) {
        const match = await this.checkOrderCompatibility(sellOrder, buyOrder);
        if (match) {
          matches.push(match);
          console.log(`🎯 Match found: ${sellOrder.orderId} <-> ${buyOrder.orderId}`);
        }
      }
    }

    return matches;
  }

  /**
   * Check if two orders are compatible and can be matched
   */
  async checkOrderCompatibility(sellOrder, buyOrder) {
    try {
      // Basic compatibility checks
      if (!this.areOrdersCompatible(sellOrder, buyOrder)) {
        return null;
      }

      // Calculate matched amounts and price
      const matchResult = this.calculateMatchDetails(sellOrder, buyOrder);
      if (!matchResult) {
        return null;
      }

      // Check if orders haven't already been matched
      const existingMatch = await Match.findOne({
        $or: [
          { buyOrderId: sellOrder.orderId, sellOrderId: buyOrder.orderId },
          { buyOrderId: buyOrder.orderId, sellOrderId: sellOrder.orderId }
        ],
        matchStatus: { $in: ['pending', 'verified', 'executing', 'executed'] }
      });

      if (existingMatch) {
        return null; // Already matched
      }

      // Create the match
      const match = await this.createMatch(sellOrder, buyOrder, matchResult);
      return match;

    } catch (error) {
      console.error('Error checking order compatibility:', error);
      return null;
    }
  }

  /**
   * Check basic order compatibility
   */
  areOrdersCompatible(sellOrder, buyOrder) {
    // Can't match with yourself
    if (sellOrder.userAddress === buyOrder.userAddress) {
      return false;
    }

    // Check if tokens match (opposite directions)
    const sellTokensMatch = sellOrder.sellToken.address === buyOrder.buyToken.address &&
                           sellOrder.buyToken.address === buyOrder.sellToken.address;
    
    if (!sellTokensMatch) {
      return false;
    }

    // Check chain compatibility (same target chain or cross-chain enabled)
    const chainCompatible = sellOrder.targetChain === buyOrder.sourceChain ||
                           sellOrder.sourceChain === buyOrder.targetChain;
    
    if (!chainCompatible) {
      return false;
    }

    // Check price compatibility
    // sellOrder wants to sell A for B at price P1 (A/B)
    // buyOrder wants to sell B for A at price P2 (B/A)
    // They match if P1 * P2 <= 1 (after normalizing for decimals)
    
    const sellPrice = sellOrder.price; // A/B
    const buyPrice = 1 / buyOrder.price; // A/B (inverted from B/A)
    
    if (sellPrice > buyPrice) {
      return false; // Prices don't match
    }

    return true;
  }

  /**
   * Calculate match details including amounts and price
   */
  calculateMatchDetails(sellOrder, buyOrder) {
    try {
      const sellRemaining = BigInt(sellOrder.remainingAmount);
      const buyRemaining = BigInt(buyOrder.remainingAmount);
      
      // Calculate how much can be matched
      // For sellOrder: remaining amount of token being sold
      // For buyOrder: remaining amount of token being sold (which is what sellOrder wants)
      
      // Convert buyOrder's remaining amount to sellOrder's sell token
      const buyOrderAmountInSellToken = this.convertAmount(
        buyOrder.remainingAmount,
        buyOrder.sellToken.decimals,
        buyOrder.buyToken.decimals,
        buyOrder.price
      );

      // The matched amount is the minimum of what both can provide
      const maxMatchAmountSell = sellRemaining < BigInt(buyOrderAmountInSellToken) ? 
        sellRemaining : BigInt(buyOrderAmountInSellToken);

      // Check minimum fill amounts
      if (sellOrder.minFillAmount !== '0' && maxMatchAmountSell < BigInt(sellOrder.minFillAmount)) {
        return null;
      }

      // Calculate the matched price (average of both orders' prices)
      const matchedPrice = (sellOrder.price + (1 / buyOrder.price)) / 2;

      return {
        matchedAmount: maxMatchAmountSell.toString(),
        matchedPrice,
        executionChain: this.selectExecutionChain(sellOrder, buyOrder)
      };

    } catch (error) {
      console.error('Error calculating match details:', error);
      return null;
    }
  }

  /**
   * Convert amount between different token decimals and price
   */
  convertAmount(amount, fromDecimals, toDecimals, price) {
    const normalizedAmount = Number(amount) / Math.pow(10, fromDecimals);
    const convertedAmount = normalizedAmount * price;
    return (convertedAmount * Math.pow(10, toDecimals)).toString();
  }

  /**
   * Select the best chain for execution
   */
  selectExecutionChain(sellOrder, buyOrder) {
    // Prefer the chain where both orders can be executed
    if (sellOrder.sourceChain === buyOrder.sourceChain) {
      return sellOrder.sourceChain;
    }
    
    if (sellOrder.targetChain === buyOrder.targetChain) {
      return sellOrder.targetChain;
    }
    
    // Default to the sell order's source chain
    return sellOrder.sourceChain;
  }

  /**
   * Create a match record in the database
   */
  async createMatch(sellOrder, buyOrder, matchDetails) {
    try {
      const matchId = ethers.id(
        `${sellOrder.orderId}-${buyOrder.orderId}-${Date.now()}`
      ).slice(0, 42);

      const match = new Match({
        matchId,
        buyOrderId: sellOrder.orderId, // sellOrder is buying from buyer's perspective
        sellOrderId: buyOrder.orderId, // buyOrder is selling from buyer's perspective
        matchedPrice: matchDetails.matchedPrice,
        matchedAmount: matchDetails.matchedAmount,
        tokenPair: {
          sellToken: {
            address: sellOrder.sellToken.address,
            symbol: sellOrder.sellToken.symbol,
            decimals: sellOrder.sellToken.decimals
          },
          buyToken: {
            address: sellOrder.buyToken.address,
            symbol: sellOrder.buyToken.symbol,
            decimals: sellOrder.buyToken.decimals
          }
        },
        executionChain: matchDetails.executionChain,
        matchStatus: 'pending'
      });

      await match.save();

      // Update order statuses
      await this.updateOrdersAfterMatch(sellOrder, buyOrder, matchDetails.matchedAmount);

      // Emit real-time updates
      this.emitMatchUpdate(match, sellOrder, buyOrder);

      console.log(`✅ Match created: ${matchId}`);
      return match;

    } catch (error) {
      console.error('Error creating match:', error);
      return null;
    }
  }

  /**
   * Update orders after they've been matched
   */
  async updateOrdersAfterMatch(sellOrder, buyOrder, matchedAmount) {
    try {
      // Update sell order
      const newSellRemaining = BigInt(sellOrder.remainingAmount) - BigInt(matchedAmount);
      sellOrder.remainingAmount = newSellRemaining.toString();
      sellOrder.filledAmount = (BigInt(sellOrder.filledAmount) + BigInt(matchedAmount)).toString();
      
      if (newSellRemaining === 0n) {
        sellOrder.orderStatus = 'filled';
      } else {
        sellOrder.orderStatus = 'partially_filled';
      }
      
      await sellOrder.save();

      // Calculate corresponding amount for buy order
      const buyOrderMatchedAmount = this.convertAmount(
        matchedAmount,
        sellOrder.sellToken.decimals,
        buyOrder.sellToken.decimals,
        1 / buyOrder.price
      );

      // Update buy order
      const newBuyRemaining = BigInt(buyOrder.remainingAmount) - BigInt(buyOrderMatchedAmount);
      buyOrder.remainingAmount = newBuyRemaining.toString();
      buyOrder.filledAmount = (BigInt(buyOrder.filledAmount) + BigInt(buyOrderMatchedAmount)).toString();
      
      if (newBuyRemaining === 0n) {
        buyOrder.orderStatus = 'filled';
      } else {
        buyOrder.orderStatus = 'partially_filled';
      }
      
      await buyOrder.save();

    } catch (error) {
      console.error('Error updating orders after match:', error);
    }
  }

  /**
   * Emit real-time updates for the match
   */
  emitMatchUpdate(match, sellOrder, buyOrder) {
    if (!this.io) return;

    const tokenPair = `${match.tokenPair.sellToken.symbol}_${match.tokenPair.buyToken.symbol}`;
    
    // Emit to orderbook subscribers
    this.io.to(`orderbook_${tokenPair}`).emit('order_matched', {
      matchId: match.matchId,
      tokenPair,
      price: match.matchedPrice,
      amount: match.matchedAmount,
      timestamp: match.matchedAt
    });

    // Emit to user subscribers
    this.io.to(`user_${sellOrder.userAddress}`).emit('order_matched', {
      orderId: sellOrder.orderId,
      matchId: match.matchId,
      status: sellOrder.orderStatus
    });

    this.io.to(`user_${buyOrder.userAddress}`).emit('order_matched', {
      orderId: buyOrder.orderId,
      matchId: match.matchId,
      status: buyOrder.orderStatus
    });
  }

  /**
   * Get matching engine statistics
   */
  async getStats() {
    const stats = await Match.aggregate([
      {
        $group: {
          _id: '$matchStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    const totalMatches = await Match.countDocuments();
    const activeOrders = await Order.countDocuments({
      orderStatus: { $in: ['open', 'partially_filled'] },
      expiryTime: { $gt: new Date() }
    });

    return {
      isRunning: this.isRunning,
      totalMatches,
      activeOrders,
      matchesByStatus: stats.reduce((acc, stat) => {
        acc[stat._id] = stat.count;
        return acc;
      }, {}),
      lastRunTime: new Date().toISOString()
    };
  }
}

// Export singleton instance
let matchingEngineInstance = null;

const createMatchingEngine = (io) => {
  if (!matchingEngineInstance) {
    matchingEngineInstance = new MatchingEngine(io);
  }
  return matchingEngineInstance;
};

const getMatchingEngine = () => {
  return matchingEngineInstance;
};

module.exports = {
  MatchingEngine,
  createMatchingEngine,
  getMatchingEngine
}; 