'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useReadContract, useWriteContract, useSignTypedData } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { toast } from 'react-hot-toast'
import { StarsBackground } from '@/components/animate-ui/backgrounds/stars'
import { io } from 'socket.io-client'

// Cross-chain contract addresses
const CROSS_CHAIN_CONTRACTS = {
  11155111: { // Sepolia
    crossChainManager: '0xfE1614f1077a95021d54b6178aD27CA91d5C2283' as `0x${string}`,
    layerZeroAdapter: '0x45a15dd9715b8d57e544da6faDf650CE297D5434' as `0x${string}`,
    axelarAdapter: '0xa3109159400C7E5b200F088DfE38B282FbcD5a51' as `0x${string}`,
    crosslineCore: '0x8B02e9416A0349A4934E0840485FA1Ed26FD21Ea' as `0x${string}`,
    weth: '0xA895E03B50672Bb7e23e33875D9d3223A04074BF' as `0x${string}`,
    usdc: '0x54EcCfc920a98f97cb2a3b375e6e4cd119e705bC' as `0x${string}`
  },
  10143: { // Monad Testnet
    crossChainManager: '0xD6Ee17e1be7129c9c1A03C8E21e84A18e9bA11f9' as `0x${string}`,
    crosslineCore: '0x8B02e9416A0349A4934E0840485FA1Ed26FD21Ea' as `0x${string}`, // Use Sepolia address as placeholder
    weth: '0xA895E03B50672Bb7e23e33875D9d3223A04074BF' as `0x${string}`, // Use Sepolia address as placeholder
    usdc: '0x54EcCfc920a98f97cb2a3b375e6e4cd119e705bC' as `0x${string}` // Use Sepolia address as placeholder
  }
}

const SUPPORTED_CHAINS = [
  { id: 11155111, name: 'Sepolia', symbol: 'ETH', color: 'from-blue-500 to-purple-500' },
  { id: 10143, name: 'Monad', symbol: 'MON', color: 'from-green-500 to-teal-500' }
]

export default function CrossChain() {
  const { isConnected, address, chainId } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  
  const [sourceChain, setSourceChain] = useState(11155111)
  const [targetChain, setTargetChain] = useState(10143)
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [crossChainOrders, setCrossChainOrders] = useState<any[]>([])
  const [crossChainFlow, setCrossChainFlow] = useState<any>(null)
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null)
  const [ethPrice, setEthPrice] = useState<number>(0)

  // Get current chain contracts
  const getContracts = (chain: number) => CROSS_CHAIN_CONTRACTS[chain as keyof typeof CROSS_CHAIN_CONTRACTS]

  // Fetch ETH price for auto-calculation
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const data = await response.json()
        const price = data.ethereum.usd
        setEthPrice(price)
        console.log(`✅ ETH Price fetched: $${price}`)
      } catch (error) {
        console.error('Failed to fetch ETH price:', error)
        setEthPrice(3000) // Fallback price
        console.log(`⚠️ Using fallback ETH price: $3000`)
      }
    }

    fetchEthPrice()
    const interval = setInterval(fetchEthPrice, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  // Auto-calculate amounts based on ETH price
  const handleSellAmountChange = (value: string) => {
    setSellAmount(value)
    if (value && ethPrice > 0) {
      const sellAmountNum = parseFloat(value)
      if (!isNaN(sellAmountNum) && sellAmountNum > 0) {
        if (orderType === 'buy') {
          // Buying ETH with USDC: sellAmount USDC -> buyAmount ETH
          const ethAmount = sellAmountNum / ethPrice
          console.log(`Auto-calc BUY: ${sellAmountNum} USDC @ $${ethPrice} = ${ethAmount} ETH`)
          // Use dynamic precision: more decimals for smaller amounts
          const precision = ethAmount < 0.001 ? 10 : ethAmount < 0.1 ? 8 : 6
          setBuyAmount(ethAmount.toFixed(precision))
        } else {
          // Selling ETH for USDC: sellAmount ETH -> buyAmount USDC
          const usdcAmount = sellAmountNum * ethPrice
          console.log(`Auto-calc SELL: ${sellAmountNum} ETH @ $${ethPrice} = ${usdcAmount} USDC`)
          setBuyAmount(usdcAmount.toFixed(2))
        }
      } else {
        setBuyAmount('')
      }
    } else {
      setBuyAmount('')
    }
  }

  const handleBuyAmountChange = (value: string) => {
    setBuyAmount(value)
    if (value && ethPrice > 0) {
      const buyAmountNum = parseFloat(value)
      if (!isNaN(buyAmountNum) && buyAmountNum > 0) {
        if (orderType === 'buy') {
          // Buying ETH with USDC: buyAmount ETH -> sellAmount USDC
          const usdcAmount = buyAmountNum * ethPrice
          console.log(`Auto-calc BUY reverse: ${buyAmountNum} ETH @ $${ethPrice} = ${usdcAmount} USDC`)
          setSellAmount(usdcAmount.toFixed(2))
        } else {
          // Selling ETH for USDC: buyAmount USDC -> sellAmount ETH
          const ethAmount = buyAmountNum / ethPrice
          console.log(`Auto-calc SELL reverse: ${buyAmountNum} USDC @ $${ethPrice} = ${ethAmount} ETH`)
          // Use dynamic precision: more decimals for smaller amounts
          const precision = ethAmount < 0.001 ? 10 : ethAmount < 0.1 ? 8 : 6
          setSellAmount(ethAmount.toFixed(precision))
        }
      } else {
        setSellAmount('')
      }
    } else {
      setSellAmount('')
    }
  }

  // Swap source and target chains
  const handleSwapChains = () => {
    const tempSource = sourceChain
    setSourceChain(targetChain)
    setTargetChain(tempSource)
    // Clear amounts when swapping chains
    setSellAmount('')
    setBuyAmount('')
  }

  // Fetch cross-chain orders
  useEffect(() => {
    // Fetch cross-chain orders
    const fetchCrossChainOrders = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/orders?crossChain=true')
        const result = await response.json()
        if (result.success) {
          setCrossChainOrders(result.data)
        }
      } catch (error) {
        console.error('Failed to fetch cross-chain orders:', error)
      }
    }

    fetchCrossChainOrders()
    const interval = setInterval(fetchCrossChainOrders, 5000) // Refresh every 5s

    // Socket.io connection for real-time updates
    const socket = io('http://localhost:8080')
    
    socket.on('order-update', (data) => {
      console.log('Real-time order update:', data)
      toast.success(`📡 ${data.message}`)
      
      // Update the specific order in the list
      setCrossChainOrders(prev => 
        prev.map(order => 
          order._id === data.orderId 
            ? { ...order, status: data.status, updatedAt: data.timestamp }
            : order
        )
      )
    })

    return () => {
      clearInterval(interval)
      socket.disconnect()
    }
  }, [])

  const handleCreateCrossChainOrder = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet')
      return
    }

    setLoading(true)
    try {
      // Create cross-chain order data
      const sourceContracts = getContracts(sourceChain)
      const targetContracts = getContracts(targetChain)

      const orderData = {
        maker: address,
        sellToken: orderType === 'buy' ? sourceContracts.usdc : sourceContracts.weth,
        buyToken: orderType === 'buy' ? targetContracts.weth : targetContracts.usdc,
        sellAmount: parseEther(sellAmount).toString(),
        buyAmount: parseEther(buyAmount).toString(),
        expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        nonce: Date.now().toString(),
        chainId: sourceChain,
        targetChain: targetChain
      }

      // Create EIP-712 typed data for cross-chain order
      const domain = {
        name: 'Crossline',
        version: '1',
        chainId: sourceChain,
        verifyingContract: sourceContracts.crosslineCore
      }

      const types = {
        CrossChainOrder: [
          { name: 'maker', type: 'address' },
          { name: 'sellToken', type: 'address' },
          { name: 'buyToken', type: 'address' },
          { name: 'sellAmount', type: 'uint256' },
          { name: 'buyAmount', type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'chainId', type: 'uint256' },
          { name: 'targetChain', type: 'uint256' }
        ]
      }

      // Sign the cross-chain order
      const signature = await signTypedDataAsync({
        domain,
        types,
        primaryType: 'CrossChainOrder',
        message: orderData
      })

      if (!signature) {
        throw new Error('Failed to sign cross-chain order')
      }

      // Submit to backend API
      const response = await fetch('http://localhost:8080/api/orders/crosschain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...orderData, signature })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to create cross-chain order')
      }

      const result = await response.json()
      
      // Show cross-chain flow
      setCrossChainFlow({
        orderId: result.orderId,
        sourceChain: SUPPORTED_CHAINS.find(c => c.id === sourceChain)?.name,
        targetChain: SUPPORTED_CHAINS.find(c => c.id === targetChain)?.name,
        status: 'initiated',
        timestamp: Date.now()
      })

      toast.success(`Cross-chain order created! Order will execute from ${SUPPORTED_CHAINS.find(c => c.id === sourceChain)?.name} to ${SUPPORTED_CHAINS.find(c => c.id === targetChain)?.name}`)
      
      // Reset form
      setSellAmount('')
      setBuyAmount('')
      
    } catch (error: any) {
      console.error('Cross-chain order creation failed:', error)
      toast.error(`Failed to create cross-chain order: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDemoProcess = async (orderId: string) => {
    if (!orderId) return
    
    setProcessingOrderId(orderId)
    
    try {
      const response = await fetch(`http://localhost:8080/api/orders/demo/process/${orderId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()
      
      if (result.success) {
        toast.success('🎭 Demo processing started! Watch the order status change.')
        
        // Refresh orders after processing
        setTimeout(() => {
          // Trigger a refresh by updating state
          setCrossChainOrders(prev => [...prev])
        }, 8000) // Wait for all stages to complete
        
      } else {
        toast.error(`Demo processing failed: ${result.error}`)
      }
    } catch (error) {
      console.error('Demo processing error:', error)
      toast.error('Demo processing failed')
    } finally {
      setProcessingOrderId(null)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <StarsBackground />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            Cross-Chain Trading
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Trade seamlessly across multiple blockchains with gasless limit orders and MEV protection
          </p>
        </div>

        {!isConnected ? (
          <div className="text-center py-16">
            <div className="glass-card-prominent p-8 max-w-md mx-auto">
              <h3 className="text-2xl font-bold mb-4">Connect Your Wallet</h3>
              <p className="text-gray-300 mb-6">Connect your wallet to start cross-chain trading</p>
              <ConnectButton />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            
            {/* Cross-Chain Order Creation */}
            <div className="glass-card-prominent p-6">
              <h2 className="text-2xl font-bold mb-6 flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></span>
                Create Cross-Chain Order
              </h2>

              {/* Chain Selection */}
              <div className="grid grid-cols-5 gap-4 mb-6 items-center">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Source Chain</label>
                  <select 
                    value={sourceChain} 
                    onChange={(e) => setSourceChain(Number(e.target.value))}
                    className="w-full bg-black/50 border border-white/70 rounded-lg px-3 py-2 text-white focus:border-white/90 focus:outline-none"
                  >
                    {SUPPORTED_CHAINS.map(chain => (
                      <option key={chain.id} value={chain.id}>{chain.name}</option>
                    ))}
                  </select>
                </div>
                
                <div className="col-span-1 flex justify-center pt-6">
                  <button
                    onClick={handleSwapChains}
                    className="p-2 bg-black/30 hover:bg-black/50 border border-white/30 hover:border-white/50 rounded-lg transition-colors"
                    title="Swap chains"
                  >
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  </button>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Target Chain</label>
                  <select 
                    value={targetChain} 
                    onChange={(e) => setTargetChain(Number(e.target.value))}
                    className="w-full bg-black/50 border border-white/70 rounded-lg px-3 py-2 text-white focus:border-white/90 focus:outline-none"
                  >
                    {SUPPORTED_CHAINS.filter(c => c.id !== sourceChain).map(chain => (
                      <option key={chain.id} value={chain.id}>{chain.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Order Type Toggle */}
              <div className="flex bg-black/30 rounded-lg p-1 mb-6 border border-white/70">
                <button
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                    orderType === 'buy' 
                      ? 'bg-green-600 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setOrderType('buy')}
                >
                  Buy
                </button>
                <button
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                    orderType === 'sell' 
                      ? 'bg-red-600 text-white' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setOrderType('sell')}
                >
                  Sell
                </button>
              </div>

              {/* Amount Inputs */}
              <div className="space-y-4 mb-6">
                {/* ETH Price Display */}
                <div className="flex justify-between items-center p-3 bg-black/30 rounded-lg border border-white/20">
                  <span className="text-sm text-gray-300">Current ETH Price:</span>
                  <span className="text-sm font-medium text-green-400">
                    ${ethPrice > 0 ? ethPrice.toLocaleString() : 'Loading...'}
                  </span>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    You Pay ({SUPPORTED_CHAINS.find(c => c.id === sourceChain)?.name}) - {orderType === 'buy' ? 'USDC' : 'WETH'}
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={sellAmount}
                    onChange={(e) => handleSellAmountChange(e.target.value)}
                    className="w-full bg-black/50 border border-white/70 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-white/90 focus:outline-none"
                    step="any"
                    min="0"
                  />
                  {/* Removed minimum amount warning for cross-chain trading */}
                </div>
                
                <div className="flex justify-center">
                  <div className="p-2 bg-black/30 rounded-full border border-white/20">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    You Receive ({SUPPORTED_CHAINS.find(c => c.id === targetChain)?.name}) - {orderType === 'buy' ? 'WETH' : 'USDC'}
                  </label>
                  <input
                    type="number"
                    placeholder="0.0"
                    value={buyAmount}
                    onChange={(e) => handleBuyAmountChange(e.target.value)}
                    className="w-full bg-black/50 border border-white/70 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-white/90 focus:outline-none"
                    step="any"
                    min="0"
                  />
                  {/* Show calculation details */}
                  {buyAmount && sellAmount && ethPrice > 0 && (
                    <p className="text-xs text-green-400 mt-1">
                      📊 Rate: 1 ETH = ${ethPrice.toLocaleString()} USDC
                    </p>
                  )}
                </div>
                
                {/* Cross-Chain Info */}
                <div className="p-3 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg border border-blue-500/30">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-xs font-medium text-blue-400">🌐 CROSS-CHAIN TRADE</span>
                  </div>
                  <p className="text-xs text-gray-300">
                    Your order will be created on {SUPPORTED_CHAINS.find(c => c.id === sourceChain)?.name} and executed on {SUPPORTED_CHAINS.find(c => c.id === targetChain)?.name} via LayerZero/Axelar messaging.
                  </p>
                </div>
              </div>

              <button
                onClick={handleCreateCrossChainOrder}
                disabled={loading || !sellAmount || !buyAmount}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Creating Cross-Chain Order...' : `Create Cross-Chain ${orderType.toUpperCase()} Order`}
              </button>
            </div>

            {/* Cross-Chain Flow Visualization */}
            <div className="glass-card-prominent p-6">
              <h2 className="text-2xl font-bold mb-6">Live Cross-Chain Flow</h2>
              
              {crossChainFlow ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg border border-green-500/50">
                    <div>
                      <h3 className="font-bold text-green-400">Order Initiated</h3>
                      <p className="text-sm text-gray-300">Order ID: {crossChainFlow.orderId}</p>
                    </div>
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  </div>
                  
                  <div className="flex items-center justify-center">
                    <div className="flex items-center space-x-4">
                      <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${SUPPORTED_CHAINS.find(c => c.name === crossChainFlow.sourceChain)?.color} text-white font-medium`}>
                        {crossChainFlow.sourceChain}
                      </div>
                      <div className="flex-1 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500 relative">
                        <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full animate-ping"></div>
                      </div>
                      <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${SUPPORTED_CHAINS.find(c => c.name === crossChainFlow.targetChain)?.color} text-white font-medium`}>
                        {crossChainFlow.targetChain}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-black/30 rounded-lg border border-blue-500/50">
                    <h3 className="font-bold text-blue-400">Cross-Chain Message</h3>
                    <p className="text-sm text-gray-300">Processing via LayerZero/Axelar...</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-2xl">🌐</span>
                  </div>
                  <p className="text-gray-400">Create a cross-chain order to see the live flow</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cross-Chain Orders List */}
        {isConnected && crossChainOrders.length > 0 && (
          <div className="mt-8 glass-card-prominent p-6">
            <h2 className="text-2xl font-bold mb-6">Recent Cross-Chain Orders</h2>
            <div className="space-y-4">
              {crossChainOrders.slice(0, 5).map((order, index) => (
                <div key={index} className="p-4 bg-black/30 rounded-lg border border-white/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium text-green-400">Cross-Chain Order</span>
                      <p className="text-sm text-gray-300">
                        {order.sourceChain} → {order.targetChain}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{order.sellAmount} → {order.buyAmount}</p>
                      <p className="text-sm text-gray-400">{order.status}</p>
                    </div>
                    <div className="flex space-x-2">
                      {order.status === 'active' && (
                        <button
                          onClick={() => handleDemoProcess(order._id)}
                          disabled={processingOrderId === order._id}
                          className="px-3 py-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          {processingOrderId === order._id ? '⚡ Processing...' : '🎭 Demo Process'}
                        </button>
                      )}
                      {(order.status === 'matching' || order.status === 'executing' || order.status === 'cross_chain_messaging') && (
                        <div className="px-3 py-1 bg-black/30 rounded-lg border border-yellow-400/50 flex items-center space-x-2">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                          <span className="text-xs text-yellow-400 font-medium">Processing...</span>
                        </div>
                      )}
                      {order.status === 'completed' && (
                        <div className="px-3 py-1 bg-green-600/20 border border-green-400/50 rounded-lg">
                          <span className="text-xs text-green-400 font-medium">✅ Completed</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 