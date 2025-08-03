const mongoose = require('mongoose');
const logger = require('./utils/logger');

async function testConnection() {
  try {
    console.log('🔍 Testing MongoDB connection...');
    await mongoose.connect('mongodb://127.0.0.1:27017/crossline');
    console.log('✅ MongoDB connected successfully!');
    console.log(`📍 Database: ${mongoose.connection.name}`);
    console.log(`🔗 Host: ${mongoose.connection.host}:${mongoose.connection.port}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('🔍 Full error:', error.toString());
    process.exit(1);
  }
}

testConnection(); 