# 🔗 Crossline

**Cross-chain gasless limit orders with MEV protection**

A hackathon project that enables gasless limit orders across different blockchains without relying on official APIs.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Hardhat](https://img.shields.io/badge/Hardhat-2.19.0-blue)](https://hardhat.org/)
[![React](https://img.shields.io/badge/React-18.2.0-blue)](https://reactjs.org/)

## 🎯 Features

- **🚀 Gasless Limit Orders**: Users don't pay gas for order creation
- **🌐 Cross-Chain Execution**: Trade across Ethereum, Polygon, Arbitrum
- **🛡️ MEV Protection**: Orders protected from frontrunning
- **🔧 Custom Implementation**: No official limit order API dependencies
- **⛓️ Onchain Settlement**: All trades settled onchain for demo
- **📱 Beautiful UI**: Professional React frontend with real-time updates
- **🔄 Real-time Updates**: Socket.IO integration for live order tracking

## 🚀 Quick Start

### 🎭 Hackathon Demo (Recommended)

```bash
# One-command setup for demo
./setup.sh --demo

# Start all services
./start.sh

# Open http://localhost:3000 and start trading!
```

### 🛠️ Manual Setup

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Compile contracts
npm run compile

# Start services
npm run dev
```

## 📋 Requirements

- **Node.js** v18+ 
- **npm** v8+
- **Git**
- **MongoDB** (optional, uses in-memory for demo)
- **Redis** (optional, uses in-memory for demo)

## 📁 Project Structure

```
crossline/
├── contracts/              # Smart contracts
│   ├── core/               # Main limit order logic
│   ├── cross-chain/        # LayerZero/Axelar adapters
│   ├── interfaces/         # Contract interfaces
│   ├── libraries/          # Reusable libraries
│   └── mocks/              # Testing contracts
├── backend/                # Node.js API server
│   ├── models/             # Database models
│   ├── routes/             # API endpoints
│   ├── services/           # Business logic
│   └── middleware/         # Express middleware
├── frontend/               # React application
│   ├── src/components/     # UI components
│   ├── src/pages/          # Application pages
│   ├── src/context/        # React contexts
│   └── src/services/       # API services
├── scripts/                # Deployment scripts
├── test/                   # Contract tests
└── docker/                 # Docker configuration
```

## 🎭 Demo Walkthrough

The demo showcases:

1. **💼 Wallet Connection** - Multi-wallet support (MetaMask, WalletConnect)
2. **📝 Order Creation** - Gasless limit order placement
3. **📊 Order Book** - Real-time order matching visualization
4. **🌐 Cross-Chain Trading** - Orders across different blockchains
5. **⚡ Real-time Updates** - Live notifications and order status
6. **📈 Trading History** - Performance metrics and trade analytics

### Demo Accounts

The demo includes pre-configured accounts with tokens:
- **Alice**: 10 WETH (for selling)
- **Bob**: 50,000 USDC (for buying)  
- **Charlie**: 1 WBTC (for cross-chain orders)

## 🔧 Available Scripts

### Root Commands
```bash
npm run setup           # Interactive setup wizard
npm run setup:demo      # Demo setup with sample data
npm start              # Start all services
npm stop               # Stop all services
npm run dev            # Development mode with hot reload
npm run build          # Production build
npm test               # Run all tests
npm run lint           # Lint all code
```

### Contract Commands
```bash
npm run compile        # Compile smart contracts
npm run deploy:local   # Deploy to local network
npm run deploy:sepolia # Deploy to Sepolia testnet
npm run demo           # Run trading demo
npm run node           # Start Hardhat node
```

### Service Commands
```bash
npm run dev:backend    # Start backend in dev mode
npm run dev:frontend   # Start frontend in dev mode
```

## 🌐 Deployment

### 🐳 Docker Deployment

```bash
# Start all services with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services  
docker-compose down
```

### ☁️ Production Deployment

```bash
# Setup for production
./setup.sh --production

# Build for production
npm run build

# Deploy contracts to mainnet
npm run deploy:polygon
npm run deploy:arbitrum
```

## 🧪 Testing

```bash
# Run contract tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npx hardhat test test/CrosslineCore.test.js
```

## 🔗 Network Support

| Network | Chain ID | Status | Features |
|---------|----------|--------|----------|
| Localhost | 31337 | ✅ Full | All features + demo data |
| Sepolia | 11155111 | ✅ Full | Testnet deployment |
| Ethereum | 1 | 🟡 Ready | Production ready |
| Polygon | 137 | 🟡 Ready | Production ready |
| Arbitrum | 42161 | 🟡 Ready | Production ready |

## 🏗️ Architecture

### Smart Contracts
- **CrosslineCore**: Main order execution engine
- **TokenHandler**: Safe ERC20 token management
- **LayerZeroAdapter**: Cross-chain messaging via LayerZero
- **AxelarAdapter**: Cross-chain messaging via Axelar
- **CrossChainManager**: Multi-protocol message routing

### Backend Services
- **Order Management**: RESTful API for order CRUD
- **Matching Engine**: Custom off-chain order matching
- **Trade Executor**: Onchain settlement coordination
- **Real-time Updates**: Socket.IO for live data

### Frontend Application
- **Modern React UI**: Professional trading interface
- **Web3 Integration**: Multi-wallet connectivity
- **Real-time Data**: Live order book and notifications
- **Responsive Design**: Mobile-first approach

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎉 Hackathon Notes

This project was built for a blockchain hackathon with focus on:
- **Innovation**: True cross-chain trading without bridges
- **Usability**: Gasless orders for better UX  
- **Security**: MEV protection and signature verification
- **Completeness**: Full-stack implementation with UI

All requirements satisfied:
- ✅ Onchain execution demonstrated
- ✅ Custom implementation (no official APIs)
- ✅ Consistent commit history
- ✅ Professional UI (stretch goal achieved)

---

<div align="center">
  <strong>Built with ❤️ for the blockchain community</strong>
  <br>
  <sub>Happy trading! 🚀</sub>
</div> 