const mongoose = require('mongoose');

// For hackathon demo, we'll use a simple in-memory store
// In production, you'd use a real MongoDB instance
let isConnected = false;
const orders = new Map(); // Simple in-memory storage for demo

const connectDB = async () => {
  try {
    if (isConnected) {
      console.log('📦 Database already connected');
      return;
    }

    // For demo purposes, we'll simulate a database connection
    console.log('📦 Connecting to in-memory database for demo...');
    isConnected = true;
    console.log('✅ Database connected successfully (demo mode)');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

// Simple in-memory database operations for demo
const db = {
  orders,
  isConnected: () => isConnected
};

module.exports = { connectDB, db }; 