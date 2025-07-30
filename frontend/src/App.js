import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useAccount } from 'wagmi';

// Components
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Trading from './pages/Trading';
import Orders from './pages/Orders';
import History from './pages/History';
import ConnectWallet from './components/ConnectWallet';

// Context
import { SocketProvider } from './context/SocketContext';
import { ContractsProvider } from './context/ContractsContext';

function App() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-gray-50">
      <Router>
        <SocketProvider>
          <ContractsProvider>
            <Navbar />
            
            <main className="container mx-auto px-4 py-8">
              {!isConnected ? (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="text-center">
                    <div className="mb-8">
                      <h1 className="text-4xl font-bold text-gradient mb-4">
                        Welcome to Crossline
                      </h1>
                      <p className="text-xl text-gray-600 mb-8">
                        Cross-chain gasless limit orders with MEV protection
                      </p>
                      <div className="flex justify-center space-x-4 mb-8">
                        <div className="flex items-center text-sm text-gray-500">
                          <div className="w-2 h-2 bg-success-500 rounded-full mr-2"></div>
                          Gasless Orders
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <div className="w-2 h-2 bg-primary-500 rounded-full mr-2"></div>
                          Cross-Chain
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <div className="w-2 h-2 bg-warning-500 rounded-full mr-2"></div>
                          MEV Protected
                        </div>
                      </div>
                    </div>
                    <ConnectWallet />
                  </div>
                </div>
              ) : (
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/trading" element={<Trading />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/history" element={<History />} />
                </Routes>
              )}
            </main>
          </ContractsProvider>
        </SocketProvider>
      </Router>
    </div>
  );
}

export default App; 