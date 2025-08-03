#!/bin/bash

echo "🚀 STARTING CROSSLINE DEMO ENVIRONMENT"
echo "======================================"

# Kill any existing processes
echo "🔄 Cleaning up existing processes..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true

# Wait for cleanup
sleep 2

echo "📦 Starting Backend..."
cd backend && npm start > ../backend.log 2>&1 &
BACKEND_PID=$!

echo "🌐 Starting Frontend..."
cd ../frontend && npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

echo "⏳ Waiting for services to start..."
sleep 10

# Test backend
echo "🧪 Testing Backend..."
if curl -s http://localhost:8080/api/health | grep -q "ok"; then
    echo "✅ Backend is running on http://localhost:8080"
else
    echo "❌ Backend failed to start"
fi

# Test frontend (try both ports)
echo "🧪 Testing Frontend..."
if curl -s http://localhost:3001 --max-time 3 | grep -q "Crossline" 2>/dev/null; then
    echo "✅ Frontend is running on http://localhost:3001"
    FRONTEND_URL="http://localhost:3001"
elif curl -s http://localhost:3002 --max-time 3 | grep -q "Crossline" 2>/dev/null; then
    echo "✅ Frontend is running on http://localhost:3002"
    FRONTEND_URL="http://localhost:3002"
else
    echo "❌ Frontend may still be starting... check manually"
    FRONTEND_URL="http://localhost:3001 or http://localhost:3002"
fi

echo ""
echo "🎉 CROSSLINE DEMO IS READY!"
echo "=========================="
echo "Frontend: $FRONTEND_URL"
echo "Backend:  http://localhost:8080"
echo "Smart Contract (Sepolia): 0x6062dfA6611B30593EF6D6990DaACd4E8121d488"
echo ""
echo "📋 DEMO CHECKLIST:"
echo "1. Open frontend URL in browser"
echo "2. Connect MetaMask wallet"
echo "3. Switch to Sepolia testnet"
echo "4. Follow DEMO_SCRIPT.md"
echo ""
echo "🔧 To stop services:"
echo "kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "📊 Logs:"
echo "Backend: tail -f backend.log"
echo "Frontend: tail -f frontend.log"
echo ""
echo "🚀 Ready for hackathon demo! Good luck! 🏆" 