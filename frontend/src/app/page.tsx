'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { StarsBackground } from '@/components/animate-ui/backgrounds/stars'

interface Stats {
  activeOrders: number
  totalTrades: number
  volumeTraded: string
  gasSaved: string
}

export default function Home() {
  const { isConnected, address } = useAccount()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [stats, setStats] = useState<Stats>({
    activeOrders: 0,
    totalTrades: 0,
    volumeTraded: '$0',
    gasSaved: '100%'
  })
  const [loading, setLoading] = useState(true)

  // Fetch real stats from backend
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch overall system stats
        const healthResponse = await fetch('http://localhost:8080/api/health')
        if (healthResponse.ok) {
          const healthData = await healthResponse.json()
          
          // Fetch user-specific orders if connected
          let userActiveOrders = 0
          if (isConnected && address) {
            const ordersResponse = await fetch(`http://localhost:8080/api/orders?maker=${address.toLowerCase()}&status=active`)
            if (ordersResponse.ok) {
              const ordersData = await ordersResponse.json()
              userActiveOrders = ordersData.data?.orders?.length || 0
            }
          }

          setStats({
            activeOrders: isConnected ? userActiveOrders : healthData.stats?.totalOrders || 0,
            totalTrades: healthData.stats?.totalMatches || 0,
            volumeTraded: '$0', // TODO: Calculate from matches
            gasSaved: '100%'
          })
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [isConnected, address])

  if (!isConnected) {
    return (
      <StarsBackground className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="glass-card-prominent rounded-3xl p-6 sm:p-12 text-center max-w-2xl w-full">
          <h1 className="text-4xl sm:text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4 sm:mb-6">
            Crossline
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 mb-6 sm:mb-8">
            Gasless cross-chain limit orders with MEV protection
          </p>
          <p className="text-gray-400 mb-6 sm:mb-8">
            Connect your wallet to start trading
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
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
              <img src="/crossline-logo.svg" alt="Crossline" className="w-8 h-8" />
              <span className="text-xl font-bold text-white">Crossline</span>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/trading" className="text-gray-300 hover:text-white transition-colors">Trading</Link>
              <Link href="/orders" className="text-gray-300 hover:text-white transition-colors">Orders</Link>
              <Link href="/history" className="text-gray-300 hover:text-white transition-colors">History</Link>
              <ConnectButton />
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-white/10 py-4">
              <div className="flex flex-col space-y-4">
                <Link 
                  href="/trading" 
                  className="text-gray-300 hover:text-white transition-colors px-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Trading
                </Link>
                <Link 
                  href="/orders" 
                  className="text-gray-300 hover:text-white transition-colors px-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Orders
                </Link>
                <Link 
                  href="/history" 
                  className="text-gray-300 hover:text-white transition-colors px-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  History
                </Link>
                <div className="px-2">
                  <ConnectButton />
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="space-y-6 sm:space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Welcome to Crossline
            </h1>
            <p className="text-gray-300 text-base sm:text-lg">
              Your gasless cross-chain trading dashboard
            </p>
            <p className="text-xs sm:text-sm text-gray-400 mt-2 break-all sm:break-normal">
              Connected: {address}
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            <Link href="/trading">
              <div className="glass-card-prominent rounded-2xl p-4 sm:p-6 hover:border-white/90 transition-all duration-300">
                <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">📊</div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Create Order</h3>
                <p className="text-gray-300 text-sm sm:text-base">Place gasless limit orders across chains</p>
              </div>
            </Link>
            <Link href="/orders">
              <div className="glass-card-prominent rounded-2xl p-4 sm:p-6 hover:border-white/90 transition-all duration-300">
                <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">📋</div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">My Orders</h3>
                <p className="text-gray-300 text-sm sm:text-base">View and manage active orders</p>
              </div>
            </Link>
            <Link href="/history">
              <div className="glass-card-prominent rounded-2xl p-4 sm:p-6 hover:border-white/90 transition-all duration-300">
                <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">📈</div>
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Trade History</h3>
                <p className="text-gray-300 text-sm sm:text-base">View past trades and statistics</p>
              </div>
            </Link>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="glass-card-prominent rounded-xl p-3 sm:p-4">
              <h4 className="text-xs sm:text-sm text-gray-400 mb-1">
                {isConnected ? 'My Active Orders' : 'Total Active Orders'}
              </h4>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-6 sm:h-8 bg-gray-600 rounded w-8"></div>
                </div>
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-white">{stats.activeOrders}</p>
              )}
            </div>
            <div className="glass-card-prominent rounded-xl p-3 sm:p-4">
              <h4 className="text-xs sm:text-sm text-gray-400 mb-1">Total Trades</h4>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-6 sm:h-8 bg-gray-600 rounded w-8"></div>
                </div>
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-white">{stats.totalTrades}</p>
              )}
            </div>
            <div className="glass-card-prominent rounded-xl p-3 sm:p-4">
              <h4 className="text-xs sm:text-sm text-gray-400 mb-1">Volume Traded</h4>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-6 sm:h-8 bg-gray-600 rounded w-12"></div>
                </div>
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-white">{stats.volumeTraded}</p>
              )}
            </div>
            <div className="glass-card-prominent rounded-xl p-3 sm:p-4">
              <h4 className="text-xs sm:text-sm text-gray-400 mb-1">Gas Saved</h4>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-6 sm:h-8 bg-gray-600 rounded w-16"></div>
                </div>
              ) : (
                <p className="text-xl sm:text-2xl font-bold text-green-400">{stats.gasSaved}</p>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="glass-card-prominent rounded-2xl p-4 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Why Crossline?</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-blue-400 mb-2">⛽ Gasless Trading</h3>
                <p className="text-gray-300 text-sm sm:text-base">Create limit orders without paying gas fees. Our relayer network handles execution costs, making trading accessible to everyone.</p>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-purple-400 mb-2">🌉 Cross-Chain</h3>
                <p className="text-gray-300 text-sm sm:text-base">Trade across Ethereum, Polygon, Arbitrum, Monad, and more. One interface for all your multi-chain trading needs.</p>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-green-400 mb-2">🛡️ MEV Protection</h3>
                <p className="text-gray-300 text-sm sm:text-base">Off-chain order book prevents front-running and sandwich attacks. Your trades are protected from malicious MEV extraction.</p>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-yellow-400 mb-2">⚡ Fast Execution</h3>
                <p className="text-gray-300 text-sm sm:text-base">Automated matching and execution engine processes orders in milliseconds. No waiting, no slippage surprises.</p>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-cyan-400 mb-2">🔒 Non-Custodial</h3>
                <p className="text-gray-300 text-sm sm:text-base">You maintain full control of your assets. Smart contracts handle execution without requiring deposits or custody.</p>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-pink-400 mb-2">📈 Advanced Orders</h3>
                <p className="text-gray-300 text-sm sm:text-base">Set limit orders, stop-losses, and take-profits. Professional trading tools for sophisticated strategies.</p>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-orange-400 mb-2">🎯 Best Prices</h3>
                <p className="text-gray-300 text-sm sm:text-base">Intelligent routing finds the best execution prices across multiple DEXs and liquidity sources automatically.</p>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-indigo-400 mb-2">⏰ 24/7 Trading</h3>
                <p className="text-gray-300 text-sm sm:text-base">Your orders work around the clock. Set and forget - our system executes when conditions are met, even while you sleep.</p>
              </div>
            </div>
            
            {/* Additional Benefits */}
            <div className="border-t border-white/20 pt-4 sm:pt-6">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-4">Built for the Future of DeFi</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="glass-card rounded-lg p-4">
                  <div className="text-2xl mb-2">🚀</div>
                  <h4 className="font-semibold text-white mb-1">High Performance</h4>
                  <p className="text-xs sm:text-sm text-gray-400">Built on cutting-edge infrastructure for maximum speed and reliability</p>
                </div>
                <div className="glass-card rounded-lg p-4">
                  <div className="text-2xl mb-2">🌍</div>
                  <h4 className="font-semibold text-white mb-1">Global Access</h4>
                  <p className="text-xs sm:text-sm text-gray-400">Trade from anywhere in the world with just a Web3 wallet connection</p>
                </div>
                <div className="glass-card rounded-lg p-4 sm:col-span-2 lg:col-span-1">
                  <div className="text-2xl mb-2">🔧</div>
                  <h4 className="font-semibold text-white mb-1">Developer Friendly</h4>
                  <p className="text-xs sm:text-sm text-gray-400">Open-source protocol with APIs for integration and custom applications</p>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="mt-6 sm:mt-8 text-center">
              <Link 
                href="/trading"
                className="inline-flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 sm:py-4 px-6 sm:px-8 rounded-lg transition-colors border border-purple-400/50 text-base sm:text-lg"
              >
                <span>🚀</span>
                <span>Start Trading Now</span>
              </Link>
              <p className="text-gray-400 text-xs sm:text-sm mt-3">No registration required • Connect wallet to begin</p>
            </div>
          </div>
        </div>
      </main>
    </StarsBackground>
  )
}
