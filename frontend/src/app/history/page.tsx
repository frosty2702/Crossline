'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { formatEther } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { StarsBackground } from '@/components/animate-ui/backgrounds/stars'

interface Trade {
  id: string
  buyOrderMaker: string
  sellOrderMaker: string
  sellToken: string
  buyToken: string
  matchedAmount: string
  executedAt: string
  transactionHash?: string
  status: string
}

export default function History() {
  const { isConnected, address } = useAccount()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isConnected && address) {
      fetchTrades()
    }
  }, [isConnected, address])

  const fetchTrades = async () => {
    try {
      const response = await fetch(`http://localhost:8080/api/trades?user=${address}`)
      if (response.ok) {
        const data = await response.json()
        setTrades(data.trades || [])
      }
    } catch (error) {
      console.error('Error fetching trades:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTokenSymbol = (address: string) => {
    if (address.toLowerCase().includes('7b79995e5f793a07bc00c21412e50ecae098e7f9')) return 'WETH'
    if (address.toLowerCase().includes('1c7d4b196cb0c7b01d743fbc6116a902379c7238')) return 'USDC'
    return 'TOKEN'
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString()
  }

  const getTradeType = (trade: Trade) => {
    const isBuyer = trade.buyOrderMaker.toLowerCase() === address?.toLowerCase()
    const sellSymbol = getTokenSymbol(trade.sellToken)
    const buySymbol = getTokenSymbol(trade.buyToken)
    
    if (isBuyer) {
      return sellSymbol === 'USDC' ? 'BOUGHT ETH' : 'BOUGHT USDC'
    } else {
      return sellSymbol === 'WETH' ? 'SOLD ETH' : 'SOLD USDC'
    }
  }

  const getTradeTypeColor = (trade: Trade) => {
    const type = getTradeType(trade)
    return type.includes('BOUGHT') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
  }

  if (!isConnected) {
    return (
      <StarsBackground className="min-h-screen flex items-center justify-center">
        <div className="glass-card-prominent rounded-3xl p-12 text-center">
          <h1 className="text-4xl font-bold text-white mb-6">Connect Wallet to View History</h1>
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
              <Link href="/history" className="text-white font-medium">History</Link>
              <ConnectButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-white">Trade History</h1>
            <div className="flex space-x-4">
              <Link 
                href="/orders"
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors border border-gray-400/50"
              >
                View Orders
              </Link>
              <Link 
                href="/trading"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors border border-purple-400/50"
              >
                Start Trading
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
              <p className="text-gray-300 mt-4">Loading trade history...</p>
            </div>
          ) : trades.length === 0 ? (
            <div className="glass-card-prominent rounded-2xl p-12 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">No Trades Found</h2>
              <p className="text-gray-300 mb-6">You haven't completed any trades yet.</p>
              <Link 
                href="/trading"
                className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors border border-purple-400/50"
              >
                Start Trading Now
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass-card-prominent rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Total Trades</h3>
                  <p className="text-3xl font-bold text-blue-400">{trades.length}</p>
                </div>
                <div className="glass-card-prominent rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Successful</h3>
                  <p className="text-3xl font-bold text-green-400">
                    {trades.filter(t => t.status === 'completed').length}
                  </p>
                </div>
                <div className="glass-card-prominent rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Volume (ETH)</h3>
                  <p className="text-3xl font-bold text-purple-400">
                    {trades.reduce((sum, trade) => {
                      const amount = formatEther(BigInt(trade.matchedAmount))
                      return sum + parseFloat(amount)
                    }, 0).toFixed(4)}
                  </p>
                </div>
              </div>

              {/* Trades Table */}
              <div className="glass-card-prominent rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-black/20">
                      <tr>
                        <th className="text-left text-gray-300 font-medium py-4 px-6">Type</th>
                        <th className="text-left text-gray-300 font-medium py-4 px-6">Amount</th>
                        <th className="text-left text-gray-300 font-medium py-4 px-6">Tokens</th>
                        <th className="text-left text-gray-300 font-medium py-4 px-6">Counterparty</th>
                        <th className="text-left text-gray-300 font-medium py-4 px-6">Status</th>
                        <th className="text-left text-gray-300 font-medium py-4 px-6">Date</th>
                        <th className="text-left text-gray-300 font-medium py-4 px-6">Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trades.map((trade, index) => {
                        const sellSymbol = getTokenSymbol(trade.sellToken)
                        const buySymbol = getTokenSymbol(trade.buyToken)
                        const amount = formatEther(BigInt(trade.matchedAmount))
                        const isBuyer = trade.buyOrderMaker.toLowerCase() === address?.toLowerCase()
                        const counterparty = isBuyer ? trade.sellOrderMaker : trade.buyOrderMaker
                        
                        return (
                          <tr key={trade.id} className={index % 2 === 0 ? 'bg-black/10' : ''}>
                            <td className="py-4 px-6">
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getTradeTypeColor(trade)}`}>
                                {getTradeType(trade)}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-white font-medium">
                              {amount} {isBuyer ? buySymbol : sellSymbol}
                            </td>
                            <td className="py-4 px-6 text-gray-300">
                              {sellSymbol} ↔ {buySymbol}
                            </td>
                            <td className="py-4 px-6 text-gray-300 font-mono text-sm">
                              {counterparty.slice(0, 6)}...{counterparty.slice(-4)}
                            </td>
                            <td className="py-4 px-6">
                              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                                trade.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                trade.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {trade.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-gray-300">
                              {formatTimestamp(trade.executedAt)}
                            </td>
                            <td className="py-4 px-6">
                              {trade.transactionHash ? (
                                <a
                                  href={`https://sepolia.etherscan.io/tx/${trade.transactionHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 text-sm"
                                >
                                  View ↗
                                </a>
                              ) : (
                                <span className="text-gray-500 text-sm">N/A</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <StarsBackground />
    </StarsBackground>
  )
} 