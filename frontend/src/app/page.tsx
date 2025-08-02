'use client'

import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'

export default function Home() {
  const { isConnected, address } = useAccount()

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20 text-center">
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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
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
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <h3 className="text-xl font-semibold text-white mb-2">🔄 Create Order</h3>
                <p className="text-gray-300">Place gasless limit orders across chains</p>
              </div>
            </Link>

            <Link href="/orders" className="group">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <h3 className="text-xl font-semibold text-white mb-2">📋 My Orders</h3>
                <p className="text-gray-300">View and manage active orders</p>
              </div>
            </Link>

            <Link href="/history" className="group">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <h3 className="text-xl font-semibold text-white mb-2">📈 Trade History</h3>
                <p className="text-gray-300">View past trades and performance</p>
              </div>
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <h4 className="text-sm text-gray-400 mb-1">Active Orders</h4>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <h4 className="text-sm text-gray-400 mb-1">Total Trades</h4>
              <p className="text-2xl font-bold text-white">0</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <h4 className="text-sm text-gray-400 mb-1">Volume Traded</h4>
              <p className="text-2xl font-bold text-white">$0</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20">
              <h4 className="text-sm text-gray-400 mb-1">Gas Saved</h4>
              <p className="text-2xl font-bold text-green-400">100%</p>
            </div>
          </div>

          {/* Features */}
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-6">Why Crossline?</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-blue-400 mb-2">⛽ Gasless Trading</h3>
                <p className="text-gray-300">Create limit orders without paying gas fees</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-purple-400 mb-2">🌉 Cross-Chain</h3>
                <p className="text-gray-300">Trade across Ethereum, Polygon, Arbitrum, and more</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-400 mb-2">🛡️ MEV Protection</h3>
                <p className="text-gray-300">Off-chain order book prevents front-running</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-yellow-400 mb-2">⚡ Fast Execution</h3>
                <p className="text-gray-300">Automated matching and execution engine</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
