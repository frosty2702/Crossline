'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'

// Contract addresses (from your deployments)
const CROSSLINE_CORE_ADDRESS = '0xDf110709E3D01b64BC2287607909e689baa0d9d8'
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' // Our deployed WETH on Sepolia
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' // Our deployed USDC on Sepolia

// Simplified ABI for demo
const CROSSLINE_ABI = [
  {
    "inputs": [
      {"name": "buyOrder", "type": "tuple", "components": [
        {"name": "maker", "type": "address"},
        {"name": "sellToken", "type": "address"},
        {"name": "buyToken", "type": "address"},
        {"name": "sellAmount", "type": "uint256"},
        {"name": "buyAmount", "type": "uint256"},
        {"name": "expiry", "type": "uint256"},
        {"name": "nonce", "type": "uint256"},
        {"name": "chainId", "type": "uint256"}
      ]},
      {"name": "sellOrder", "type": "tuple", "components": [
        {"name": "maker", "type": "address"},
        {"name": "sellToken", "type": "address"},
        {"name": "buyToken", "type": "address"},
        {"name": "sellAmount", "type": "uint256"},
        {"name": "buyAmount", "type": "uint256"},
        {"name": "expiry", "type": "uint256"},
        {"name": "nonce", "type": "uint256"},
        {"name": "chainId", "type": "uint256"}
      ]},
      {"name": "matchedAmount", "type": "uint256"},
      {"name": "buyOrderSignature", "type": "bytes"},
      {"name": "sellOrderSignature", "type": "bytes"}
    ],
    "name": "executeMatch",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
]

const ERC20_ABI = [
  {
    "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
]

export default function Trading() {
  const { isConnected, address } = useAccount()
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [ethPrice, setEthPrice] = useState<number>(2400) // Default ETH price in USD

  const { writeContract } = useWriteContract()

  // Fetch ETH price from API
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
        const data = await response.json()
        if (data.ethereum?.usd) {
          setEthPrice(data.ethereum.usd)
        }
      } catch (error) {
        console.log('Using default ETH price:', ethPrice)
      }
    }
    fetchEthPrice()
  }, [])

  // Auto-calculate amounts when one changes
  const handleSellAmountChange = (value: string) => {
    setSellAmount(value)
    if (value && !isNaN(parseFloat(value))) {
      const sellValue = parseFloat(value)
      if (orderType === 'buy') {
        // Buying ETH with USDC: USDC amount / ETH price = ETH amount
        const ethAmount = (sellValue / ethPrice).toFixed(6)
        setBuyAmount(ethAmount)
      } else {
        // Selling ETH for USDC: ETH amount * ETH price = USDC amount
        const usdcAmount = (sellValue * ethPrice).toFixed(2)
        setBuyAmount(usdcAmount)
      }
    } else {
      setBuyAmount('')
    }
  }

  const handleBuyAmountChange = (value: string) => {
    setBuyAmount(value)
    if (value && !isNaN(parseFloat(value))) {
      const buyValue = parseFloat(value)
      if (orderType === 'buy') {
        // Buying ETH: ETH amount * ETH price = USDC amount
        const usdcAmount = (buyValue * ethPrice).toFixed(2)
        setSellAmount(usdcAmount)
      } else {
        // Selling ETH: USDC amount / ETH price = ETH amount
        const ethAmount = (buyValue / ethPrice).toFixed(6)
        setSellAmount(ethAmount)
      }
    } else {
      setSellAmount('')
    }
  }

  // Update calculations when order type changes
  useEffect(() => {
    if (sellAmount) {
      handleSellAmountChange(sellAmount)
    }
  }, [orderType, ethPrice])

  // Read balances
  const { data: wethBalance } = useReadContract({
    address: WETH_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  const handleCreateOrder = async () => {
    if (!isConnected || !address) return
    
    setLoading(true)
    try {
      // For demo: create a simple order submission to backend
      const orderData = {
        maker: address,
        sellToken: orderType === 'buy' ? USDC_ADDRESS : WETH_ADDRESS,
        buyToken: orderType === 'buy' ? WETH_ADDRESS : USDC_ADDRESS,
        sellAmount: parseEther(sellAmount).toString(),
        buyAmount: parseEther(buyAmount).toString(),
        expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        nonce: Date.now(),
        chainId: 11155111 // Sepolia
      }

      // Submit to backend API
      const response = await fetch('http://localhost:8080/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })

      if (response.ok) {
        alert('Order created successfully!')
        setSellAmount('')
        setBuyAmount('')
      } else {
        throw new Error('Failed to create order')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (token: string) => {
    if (!isConnected) return
    
    try {
      await writeContract({
        address: token as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CROSSLINE_CORE_ADDRESS, parseEther('1000000')], // Large approval
      })
      alert('Approval transaction sent!')
    } catch (error) {
      console.error('Approval failed:', error)
      alert('Approval failed')
    }
  }

  const handleMintTokens = async () => {
    if (!isConnected || !address) return
    
    try {
      // Mint WETH
      await writeContract({
        address: WETH_ADDRESS,
        abi: [...ERC20_ABI, {
          "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
          "name": "mint",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }],
        functionName: 'mint',
        args: [address, parseEther('10')], // Mint 10 WETH
      })
      
      // Mint USDC  
      await writeContract({
        address: USDC_ADDRESS,
        abi: [...ERC20_ABI, {
          "inputs": [{"name": "to", "type": "address"}, {"name": "amount", "type": "uint256"}],
          "name": "mint",
          "outputs": [],
          "stateMutability": "nonpayable",
          "type": "function"
        }],
        functionName: 'mint',
        args: [address, parseEther('10000')], // Mint 10,000 USDC
      })
      
      alert('Tokens minted! Refresh the page to see your balances.')
    } catch (error) {
      console.error('Minting failed:', error)
      alert('Minting failed - you might already have tokens or need to use a different network')
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20 text-center">
          <h1 className="text-4xl font-bold text-white mb-6">Connect Wallet to Trade</h1>
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
              <Link href="/trading" className="text-white font-medium">Trading</Link>
              <Link href="/orders" className="text-gray-300 hover:text-white">Orders</Link>
              <Link href="/history" className="text-gray-300 hover:text-white">History</Link>
              <ConnectButton />
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">Cross-Chain Trading</h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Order Form */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-6">Create Limit Order</h2>
              
              {/* Order Type Toggle */}
              <div className="flex bg-black/20 rounded-lg p-1 mb-6">
                <button
                  onClick={() => setOrderType('buy')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                    orderType === 'buy' 
                      ? 'bg-green-500 text-white' 
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Buy ETH
                </button>
                <button
                  onClick={() => setOrderType('sell')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
                    orderType === 'sell' 
                      ? 'bg-red-500 text-white' 
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Sell ETH
                </button>
              </div>

              {/* Amount Inputs */}
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-gray-300 mb-2">
                    You Pay ({orderType === 'buy' ? 'USDC' : 'WETH'})
                  </label>
                  <input
                    type="number"
                    value={sellAmount}
                    onChange={(e) => handleSellAmountChange(e.target.value)}
                    className="w-full bg-black/20 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                    placeholder="0.0"
                    step="any"
                  />
                </div>
                
                {/* Price indicator */}
                <div className="flex items-center justify-center py-2">
                  <div className="text-gray-400 text-sm bg-gray-800/50 px-3 py-1 rounded-full">
                    ≈ 1 ETH = ${ethPrice.toLocaleString()} USDC
                  </div>
                </div>
                
                <div>
                  <label className="block text-gray-300 mb-2">
                    You Receive ({orderType === 'buy' ? 'WETH' : 'USDC'}) 
                    <span className="text-green-400 text-xs ml-2">✓ Auto-calculated</span>
                  </label>
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => handleBuyAmountChange(e.target.value)}
                    className="w-full bg-black/20 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                    placeholder="0.0"
                    step="any"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApprove(orderType === 'buy' ? USDC_ADDRESS : WETH_ADDRESS)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                  >
                    Approve {orderType === 'buy' ? 'USDC' : 'WETH'}
                  </button>
                </div>
                
                <button
                  onClick={handleMintTokens}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  🪙 Get Test Tokens (10 WETH + 10,000 USDC)
                </button>
                
                <button
                  onClick={handleCreateOrder}
                  disabled={loading || !sellAmount || !buyAmount}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {loading ? 'Creating Order...' : 'Create Limit Order'}
                </button>
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
              <h2 className="text-2xl font-bold text-white mb-6">Account</h2>
              
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Address:</span>
                  <span className="text-white font-mono text-sm">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">ETH Price:</span>
                  <span className="text-green-400 font-medium">
                    ${ethPrice.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">WETH Balance:</span>
                  <span className="text-white">
                    {wethBalance ? formatEther(wethBalance) : '0.0'} WETH
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">USDC Balance:</span>
                  <span className="text-white">
                    {usdcBalance ? formatEther(usdcBalance) : '0.0'} USDC
                  </span>
                </div>
              </div>

              {/* Network Info */}
              <div className="mt-6 pt-6 border-t border-white/20">
                <h3 className="text-lg font-semibold text-white mb-3">Network</h3>
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-green-400 font-medium">Sepolia Testnet</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
} 