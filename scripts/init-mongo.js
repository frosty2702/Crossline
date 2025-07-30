// MongoDB Initialization Script for Crossline
// This script runs when MongoDB container starts for the first time

print('🚀 Initializing Crossline database...');

// Switch to crossline database
db = db.getSiblingDB('crossline');

// Create collections with validation
db.createCollection('orders', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userAddress', 'sellToken', 'buyToken', 'sellAmount', 'buyAmount', 'sourceChain', 'targetChain', 'expiry', 'nonce', 'signature'],
      properties: {
        userAddress: { bsonType: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
        sellToken: { bsonType: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
        buyToken: { bsonType: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
        sellAmount: { bsonType: 'string' },
        buyAmount: { bsonType: 'string' },
        sourceChain: { bsonType: 'int' },
        targetChain: { bsonType: 'int' },
        expiry: { bsonType: 'int' },
        nonce: { bsonType: 'int' },
        signature: { bsonType: 'string' },
        status: { 
          bsonType: 'string',
          enum: ['Open', 'Matched', 'PartiallyFilled', 'Filled', 'Cancelled', 'Expired']
        }
      }
    }
  }
});

db.createCollection('matches', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['matchId', 'buyOrderId', 'sellOrderId', 'matchedAmount'],
      properties: {
        matchId: { bsonType: 'string' },
        buyOrderId: { bsonType: 'objectId' },
        sellOrderId: { bsonType: 'objectId' },
        matchedAmount: { bsonType: 'string' },
        executionChain: { bsonType: 'int' },
        status: {
          bsonType: 'string',
          enum: ['Pending', 'Executing', 'Completed', 'Failed']
        }
      }
    }
  }
});

// Create indexes for better performance
print('📊 Creating database indexes...');

// Orders indexes
db.orders.createIndex({ userAddress: 1, createdAt: -1 });
db.orders.createIndex({ status: 1, createdAt: -1 });
db.orders.createIndex({ sellToken: 1, buyToken: 1, status: 1 });
db.orders.createIndex({ sourceChain: 1, targetChain: 1 });
db.orders.createIndex({ expiry: 1 });
db.orders.createIndex({ nonce: 1, userAddress: 1 }, { unique: true });

// Matches indexes  
db.matches.createIndex({ matchId: 1 }, { unique: true });
db.matches.createIndex({ buyOrderId: 1 });
db.matches.createIndex({ sellOrderId: 1 });
db.matches.createIndex({ status: 1, createdAt: -1 });
db.matches.createIndex({ executionChain: 1 });

// Create demo user for development
if (db.getName() === 'crossline') {
  print('👤 Creating demo data...');
  
  // Demo token addresses (mock)
  const DEMO_TOKENS = {
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    WBTC: '0x68f180fcCe6836688e9084f035309E29Bf0A2095'
  };
  
  const DEMO_USER = '0x742d35Cc6634C0532925a3b8D0c4b0D33c36E32f';
  
  // Insert demo orders
  const demoOrders = [
    {
      userAddress: DEMO_USER,
      sellToken: DEMO_TOKENS.WETH,
      buyToken: DEMO_TOKENS.USDC,
      sellAmount: '1000000000000000000', // 1 ETH
      buyAmount: '2000000000', // 2000 USDC
      sourceChain: 31337,
      targetChain: 31337,
      expiry: Math.floor(Date.now() / 1000) + 86400, // 24 hours
      nonce: 1,
      signature: '0x' + '00'.repeat(65),
      status: 'Open',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      userAddress: DEMO_USER,
      sellToken: DEMO_TOKENS.USDC,
      buyToken: DEMO_TOKENS.WBTC,
      sellAmount: '50000000000', // 50000 USDC
      buyAmount: '100000000', // 1 WBTC
      sourceChain: 31337,
      targetChain: 137, // Cross-chain to Polygon
      expiry: Math.floor(Date.now() / 1000) + 86400,
      nonce: 2,
      signature: '0x' + '00'.repeat(65),
      status: 'Open',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];
  
  db.orders.insertMany(demoOrders);
  
  print('✅ Demo data created');
}

print('✅ Database initialization complete!');
print('📊 Collections: ' + db.getCollectionNames().length);
print('🔍 Indexes created for optimal performance');
print('');
print('🎉 Crossline database ready for trading!'); 