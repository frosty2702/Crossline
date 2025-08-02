'use client'

import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { StarsBackground } from '@/components/animate-ui/backgrounds/stars'

export default function Home() {
  const { isConnected, address } = useAccount()

  if (!isConnected) {
    return (
      <StarsBackground className="min-h-screen flex flex-col items-center justify-center">
        <div className="glass-card-prominent rounded-3xl p-12 text-center">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-6">
            Crossline
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl">
            Gasless cross-chain limit orders with MEV protection
          </p>
          <p className="text-gray-400 mb-8">
            Connect your wallet to start trading
          </p>
          <ConnectButton />
        </div>
      </StarsBackground>
    )
  }

  return (
    <StarsBackground className="min-h-screen">
      {/* Navigation */}
      <nav className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg"></div>
              <span className="text-xl font-bold text-white">Crossline</span>
            </Link>
            <div className="flex items-center space-x-6">
              <Link href="/trading" className="text-gray-300 hover:text-white">Trading</Link>
              <Link href="/orders" className="text-gray-300 hover:text-white">Orders</Link>
              <Link href="/history" className="text-gray-300 hover:text-white">History</Link>
              <ConnectButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white mb-4">
              Welcome to Crossline
            </h1>
            <p className="text-gray-300 text-lg">
              Your gasless cross-chain trading dashboard
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Connected: {address}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-6">
            <Link href="/trading" className="group">
              <div className="glass-card-prominent rounded-2xl p-6 hover:border-white/50 transition-all duration-300">
                <h3 className="text-xl font-semibold text-white mb-2">🔄 Create Order</h3>
                <p className="text-gray-300">Place gasless limit orders across chains</p>
              </div>
            </Link>

            <Link href="/orders" className="group">
              <div className="glass-card-prominent rounded-2xl p-6 hover:border-white/50 transition-all duration-300">
                <h3 className="text-xl font-semibold text-white mb-2">📋 My Orders</h3>
                <p className="text-gray-300">View and manage active orders</p>
              </div>
            </Link>

            <Link href="/history" className="group">
              <div className="glass-card-prominent rounded-2xl p-6 hover:border-white/50 transition-all duration-300">
                <h3 className="text-xl font-semibold text-white mb-2">📊 Trade History</h3>
                <p className="text-gray-300">View past trades and statistics</p>
              </div>
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="glass-card-prominent rounded-xl p-4">
              <h4 className="text-sm text-gray-400 mb-1">Active Orders</h4>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
            <div className="glass-card-prominent rounded-xl p-4">
              <h4 className="text-sm text-gray-400 mb-1">Total Trades</h4>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
            <div className="glass-card-prominent rounded-xl p-4">
              <h4 className="text-sm text-gray-400 mb-1">Volume Traded</h4>
              <p className="text-2xl font-bold text-white">$0</p>
            </div>
            <div className="glass-card-prominent rounded-xl p-4">
              <h4 className="text-sm text-gray-400 mb-1">Gas Saved</h4>
              <p className="text-2xl font-bold text-green-400">100%</p>
            </div>
          </div>

          {/* Features */}
          <div className="glass-card-prominent rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-6">Why Crossline?</h2>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">⛽ Gasless Trading</h3>
                <p className="text-gray-300">Create limit orders without paying gas fees. Our relayer network handles execution costs, making trading accessible to everyone.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-400 mb-2">🌉 Cross-Chain</h3>
                <p className="text-gray-300">Trade across Ethereum, Polygon, Arbitrum, Monad, and more. One interface for all your multi-chain trading needs.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-400 mb-2">🛡️ MEV Protection</h3>
                <p className="text-gray-300">Off-chain order book prevents front-running and sandwich attacks. Your trades are protected from malicious MEV extraction.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">⚡ Fast Execution</h3>
                <p className="text-gray-300">Automated matching and execution engine processes orders in milliseconds. No waiting, no slippage surprises.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">🔒 Non-Custodial</h3>
                <p className="text-gray-300">You maintain full control of your assets. Smart contracts handle execution without requiring deposits or custody.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-pink-400 mb-2">📈 Advanced Orders</h3>
                <p className="text-gray-300">Set limit orders, stop-losses, and take-profits. Professional trading tools for sophisticated strategies.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-orange-400 mb-2">🎯 Best Prices</h3>
                <p className="text-gray-300">Intelligent routing finds the best execution prices across multiple DEXs and liquidity sources automatically.</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-indigo-400 mb-2">⏰ 24/7 Trading</h3>
                <p className="text-gray-300">Your orders work around the clock. Set and forget - our system executes when conditions are met, even while you sleep.</p>
              </div>
            </div>
            
            {/* Additional Benefits */}
            <div className="border-t border-white/20 pt-6">
              <h3 className="text-xl font-bold text-white mb-4">Built for the Future of DeFi</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="glass-card rounded-lg p-4">
                  <div className="text-2xl mb-2">🚀</div>
                  <h4 className="font-semibold text-white mb-1">High Performance</h4>
                  <p className="text-sm text-gray-400">Built on cutting-edge infrastructure for maximum speed and reliability</p>
                </div>
                <div className="glass-card rounded-lg p-4">
                  <div className="text-2xl mb-2">🌍</div>
                  <h4 className="font-semibold text-white mb-1">Global Access</h4>
                  <p className="text-sm text-gray-400">Trade from anywhere in the world with just a Web3 wallet connection</p>
                </div>
                <div className="glass-card rounded-lg p-4">
                  <div className="text-2xl mb-2">🔧</div>
                  <h4 className="font-semibold text-white mb-1">Developer Friendly</h4>
                  <p className="text-sm text-gray-400">Open-source protocol with APIs for integration and custom applications</p>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="mt-8 text-center">
              <Link 
                href="/trading"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-4 px-8 rounded-lg transition-colors border border-purple-400/50 text-lg"
              >
                <span>🚀</span>
                <span>Start Trading Now</span>
              </Link>
              <p className="text-gray-400 text-sm mt-3">No registration required • Connect wallet to begin</p>
            </div>
          </div>
        </div>
      </main>
    </StarsBackground>
  )
}
