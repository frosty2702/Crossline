#!/usr/bin/env node

const axios = require('axios');
const { ethers } = require('hardhat');

const FRONTEND_URL = 'http://localhost:3002';
const BACKEND_URL = 'http://localhost:8080';

// Contract addresses from latest deployment
const CROSSLINE_CORE_ADDRESS = '0x6062dfA6611B30593EF6D6990DaACd4E8121d488';
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

async function testCompleteFlow() {
  console.log('🧪 TESTING COMPLETE CROSSLINE APPLICATION');
  console.log('========================================\n');

  let allTestsPassed = true;

  // Test 1: Frontend Accessibility
  console.log('1️⃣ Testing Frontend...');
  try {
    const response = await axios.get(FRONTEND_URL, { timeout: 5000 });
    if (response.data.includes('Crossline')) {
      console.log('✅ Frontend is running and accessible');
    } else {
      throw new Error('Frontend not displaying correctly');
    }
  } catch (error) {
    console.log('❌ Frontend test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 2: Backend API
  console.log('\n2️⃣ Testing Backend API...');
  try {
    const response = await axios.get(`${BACKEND_URL}/api/health`, { timeout: 5000 });
    if (response.data.status === 'ok') {
      console.log('✅ Backend API is healthy');
      console.log(`   Database: ${response.data.database}`);
      console.log(`   Orders: ${response.data.stats.totalOrders}`);
    } else {
      throw new Error('Backend not healthy');
    }
  } catch (error) {
    console.log('❌ Backend test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 3: Smart Contract Deployment
  console.log('\n3️⃣ Testing Smart Contracts...');
  try {
    const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL || 'https://sepolia.drpc.org');
    
    // Check if contracts exist
    const crosslineCoreCode = await provider.getCode(CROSSLINE_CORE_ADDRESS);
    const wethCode = await provider.getCode(WETH_ADDRESS);
    const usdcCode = await provider.getCode(USDC_ADDRESS);
    
    if (crosslineCoreCode !== '0x' && wethCode !== '0x' && usdcCode !== '0x') {
      console.log('✅ All smart contracts are deployed');
      console.log(`   CrosslineCore: ${CROSSLINE_CORE_ADDRESS}`);
      console.log(`   WETH: ${WETH_ADDRESS}`);
      console.log(`   USDC: ${USDC_ADDRESS}`);
    } else {
      throw new Error('Some contracts not deployed');
    }
  } catch (error) {
    console.log('❌ Smart contract test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 4: Trading Page
  console.log('\n4️⃣ Testing Trading Page...');
  try {
    const response = await axios.get(`${FRONTEND_URL}/trading`, { timeout: 5000 });
    if (response.data.includes('Create Limit Order') && response.data.includes('Get Test Tokens')) {
      console.log('✅ Trading page is working');
    } else {
      throw new Error('Trading page missing components');
    }
  } catch (error) {
    console.log('❌ Trading page test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 5: Orders Page
  console.log('\n5️⃣ Testing Orders Page...');
  try {
    const response = await axios.get(`${FRONTEND_URL}/orders`, { timeout: 5000 });
    if (response.data.includes('My Orders')) {
      console.log('✅ Orders page is working');
    } else {
      throw new Error('Orders page not working');
    }
  } catch (error) {
    console.log('❌ Orders page test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 6: History Page
  console.log('\n6️⃣ Testing History Page...');
  try {
    const response = await axios.get(`${FRONTEND_URL}/history`, { timeout: 5000 });
    if (response.data.includes('Trade History')) {
      console.log('✅ History page is working');
    } else {
      throw new Error('History page not working');
    }
  } catch (error) {
    console.log('❌ History page test failed:', error.message);
    allTestsPassed = false;
  }

  // Test 7: API Endpoints
  console.log('\n7️⃣ Testing API Endpoints...');
  try {
    const endpoints = ['/api/orders', '/api/orderbook', '/api/trades'];
    for (const endpoint of endpoints) {
      const response = await axios.get(`${BACKEND_URL}${endpoint}`, { timeout: 5000 });
      console.log(`✅ ${endpoint} is accessible`);
    }
  } catch (error) {
    console.log('❌ API endpoints test failed:', error.message);
    allTestsPassed = false;
  }

  // Final Results
  console.log('\n🏁 TEST RESULTS');
  console.log('================');
  if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED! Your application is ready for submission!');
    console.log('\n📋 Application URLs:');
    console.log(`   Frontend: ${FRONTEND_URL}`);
    console.log(`   Backend API: ${BACKEND_URL}`);
    console.log('\n🔗 Smart Contracts (Sepolia):');
    console.log(`   CrosslineCore: ${CROSSLINE_CORE_ADDRESS}`);
    console.log(`   WETH: ${WETH_ADDRESS}`);
    console.log(`   USDC: ${USDC_ADDRESS}`);
    console.log('\n✨ Ready for hackathon demo!');
  } else {
    console.log('❌ Some tests failed. Please fix the issues above.');
  }

  return allTestsPassed;
}

// Run the tests
testCompleteFlow().catch(console.error); 