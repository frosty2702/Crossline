'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { formatEther } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'

interface Order {
  id: string
  maker: string
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  expiry: number
  status: string
  createdAt: string
}

export default function Orders() {
  const { isConnected, address } = useAccount()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isConnected && address) {
      fetchOrders()
    }
  }, [isConnected, address])

  const fetchOrders = async () => {
    try {
      const response = await fetch(`http://localhost:8080/api/orders?maker=${address}`)
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders || [])
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const cancelOrder = async (orderId: string) => {
    try {
      const response = await fetch(`http://localhost:8080/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maker: address })
      })
      
      if (response.ok) {
        alert('Order cancelled successfully!')
        fetchOrders() // Refresh orders
      } else {
        throw new Error('Failed to cancel order')
      }
    } catch (error) {
      console.error('Error cancelling order:', error)
      alert('Failed to cancel order')
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

  const isExpired = (expiry: number) => {
    return Date.now() / 1000 > expiry
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20 text-center">
          <h1 className="text-4xl font-bold text-white mb-6">Connect Wallet to View Orders</h1>
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
              <Link href="/orders" className="text-white font-medium">Orders</Link>
              <Link href="/history" className="text-gray-300 hover:text-white">History</Link>
              <ConnectButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-white">My Orders</h1>
            <Link 
              href="/trading"
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Create New Order
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
              <p className="text-gray-300 mt-4">Loading orders...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 border border-white/20 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">No Orders Found</h2>
              <p className="text-gray-300 mb-6">You haven't created any orders yet.</p>
              <Link 
                href="/trading"
                className="inline-block bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Create Your First Order
              </Link>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-black/20">
                    <tr>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Type</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Sell Amount</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Buy Amount</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Price</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Status</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Created</th>
                      <th className="text-left text-gray-300 font-medium py-4 px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, index) => {
                      const sellSymbol = getTokenSymbol(order.sellToken)
                      const buySymbol = getTokenSymbol(order.buyToken)
                      const sellAmount = formatEther(BigInt(order.sellAmount))
                      const buyAmount = formatEther(BigInt(order.buyAmount))
                      const price = (parseFloat(sellAmount) / parseFloat(buyAmount)).toFixed(4)
                      const expired = isExpired(order.expiry)
                      
                      return (
                        <tr key={order.id} className={index % 2 === 0 ? 'bg-black/10' : ''}>
                          <td className="py-4 px-6">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                              sellSymbol === 'USDC' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {sellSymbol === 'USDC' ? 'BUY ETH' : 'SELL ETH'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-white">
                            {sellAmount} {sellSymbol}
                          </td>
                          <td className="py-4 px-6 text-white">
                            {buyAmount} {buySymbol}
                          </td>
                          <td className="py-4 px-6 text-white">
                            {price} {sellSymbol}/{buySymbol}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                              expired ? 'bg-gray-500/20 text-gray-400' :
                              order.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                              order.status === 'filled' ? 'bg-green-500/20 text-green-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {expired ? 'EXPIRED' : order.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-gray-300">
                            {formatTimestamp(order.createdAt)}
                          </td>
                          <td className="py-4 px-6">
                            {order.status === 'active' && !expired && (
                              <button
                                onClick={() => cancelOrder(order.id)}
                                className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
} 