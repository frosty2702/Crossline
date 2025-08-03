'use client'

import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, useReadContract, useSignTypedData } from 'wagmi'
import { parseEther, formatEther } from 'viem'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'
import { StarsBackground } from '@/components/animate-ui/backgrounds/stars'

// Contract addresses - will be set based on network
let CROSSLINE_CORE_ADDRESS = '0x8B02e9416A0349A4934E0840485FA1Ed26FD21Ea' // Sepolia default
let WETH_ADDRESS = '0xA895E03B50672Bb7e23e33875D9d3223A04074BF' // Sepolia default
let USDC_ADDRESS = '0x54EcCfc920a98f97cb2a3b375e6e4cd119e705bC' // Sepolia default

// Monad Testnet addresses (placeholder - you'll need to deploy these)
const MONAD_ADDRESSES = {
  CROSSLINE_CORE: '0x0000000000000000000000000000000000000000', // TODO: Deploy on Monad
  WETH: '0x0000000000000000000000000000000000000000', // TODO: Deploy on Monad
  USDC: '0x0000000000000000000000000000000000000000' // TODO: Deploy on Monad
}

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
  const { isConnected, address, chainId } = useAccount()
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy')
  const [sellAmount, setSellAmount] = useState('')
  const [buyAmount, setBuyAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [ethPrice, setEthPrice] = useState<number>(2400) // Default ETH price in USD

  const { writeContract } = useWriteContract()
  const { signTypedData } = useSignTypedData()

  // Get contract addresses based on current network
  const getContractAddresses = () => {
    if (chainId === 10143) { // Monad Testnet
      return {
        crosslineCore: '0x0000000000000000000000000000000000000000' as `0x${string}`, // TODO: Deploy on Monad
        weth: '0x0000000000000000000000000000000000000000' as `0x${string}`, // TODO: Deploy on Monad
        usdc: '0x0000000000000000000000000000000000000000' as `0x${string}` // TODO: Deploy on Monad
      }
    } else { // Sepolia or default
      return {
        crosslineCore: '0x8B02e9416A0349A4934E0840485FA1Ed26FD21Ea' as `0x${string}`,
        weth: '0xA895E03B50672Bb7e23e33875D9d3223A04074BF' as `0x${string}`,
        usdc: '0x54EcCfc920a98f97cb2a3b375e6e4cd119e705bC' as `0x${string}`
      }
    }
  }

  const contractAddresses = getContractAddresses()

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
    address: contractAddresses.weth,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  })

  const { data: usdcBalance } = useReadContract({
    address: contractAddresses.usdc,
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
      // Create order data for EIP-712 signature
      const orderData = {
        maker: address,
        sellToken: orderType === 'buy' ? contractAddresses.usdc : contractAddresses.weth,
        buyToken: orderType === 'buy' ? contractAddresses.weth : contractAddresses.usdc,
        sellAmount: parseEther(sellAmount).toString(),
        buyAmount: parseEther(buyAmount).toString(),
        expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour
        nonce: Date.now().toString(),
        chainId: 11155111 // Sepolia
      }

      // Create EIP-712 typed data
      const domain = {
        name: 'Crossline',
        version: '1',
        chainId: 11155111,
        verifyingContract: contractAddresses.crosslineCore
      }

      const types = {
        Order: [
          { name: 'maker', type: 'address' },
          { name: 'sellToken', type: 'address' },
          { name: 'buyToken', type: 'address' },
          { name: 'sellAmount', type: 'uint256' },
          { name: 'buyAmount', type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'chainId', type: 'uint256' }
        ]
      }

      // Sign the order
      const signature = await signTypedData({
        domain,
        types,
        primaryType: 'Order',
        message: orderData
      })

      // Add signature to order data
      const signedOrderData = {
        ...orderData,
        signature
      }

      // Submit to backend API
      const response = await fetch('http://localhost:8080/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedOrderData)
      })

      if (response.ok) {
        alert('Order created successfully!')
        setSellAmount('')
        setBuyAmount('')
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create order')
      }
    } catch (error) {
      console.error('Error creating order:', error)
      alert('Failed to create order: ' + (error instanceof Error ? error.message : 'Unknown error'))
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
        args: [contractAddresses.crosslineCore, parseEther('1000000')], // Large approval
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
      // Mint WETH first
      console.log('Minting WETH...')
      await writeContract({
        address: contractAddresses.weth,
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
      
      // Wait a moment then mint USDC
      setTimeout(async () => {
        try {
          console.log('Minting USDC...')
          await writeContract({
            address: contractAddresses.usdc,
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
          
          alert('🎉 Both tokens minted successfully! Wait 30 seconds then refresh to see balances.')
        } catch (error) {
          console.error('USDC minting error:', error)
          alert('WETH minted! USDC failed - try clicking the button again.')
        }
      }, 3000)
      
    } catch (error) {
      console.error('Minting failed:', error)
      alert('Token minting failed. Make sure you:\n• Are on Sepolia testnet\n• Have ETH for gas\n• Approve transactions in MetaMask')
    }
  }

  // Show warning if on Monad (contracts not deployed there)
  const showNetworkWarning = chainId === 10143

  if (!isConnected) {
    return (
      <StarsBackground className="min-h-screen flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-12 border border-white/20 text-center">
          <h1 className="text-4xl font-bold text-white mb-6">Connect Wallet to Trade</h1>
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
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-6 sm:mb-8">Cross-Chain Trading</h1>
          
          {/* Network Warning */}
          {showNetworkWarning && (
            <div className="glass-card-prominent rounded-2xl p-6 mb-6 border-red-400/50">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
                <div>
                  <h3 className="text-red-400 font-semibold">Contracts Not Deployed on Monad</h3>
                  <p className="text-gray-300 text-sm">
                    Switch to Sepolia Testnet to use the deployed contracts and mock tokens.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
            {/* Order Form */}
            <div className="glass-card-prominent rounded-2xl p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Create Limit Order</h2>
              
              {/* Order Type Toggle */}
              <div className="flex bg-black/40 rounded-lg p-1 mb-4 sm:mb-6 border border-white/20">
                <button
                  onClick={() => setOrderType('buy')}
                  className={`flex-1 py-2 px-3 sm:px-4 rounded-md font-medium transition-colors text-sm sm:text-base ${
                    orderType === 'buy' 
                      ? 'bg-green-500 text-white' 
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Buy ETH
                </button>
                <button
                  onClick={() => setOrderType('sell')}
                  className={`flex-1 py-2 px-3 sm:px-4 rounded-md font-medium transition-colors text-sm sm:text-base ${
                    orderType === 'sell' 
                      ? 'bg-red-500 text-white' 
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Sell ETH
                </button>
              </div>

              {/* Amount Inputs */}
              <div className="space-y-4 mb-4 sm:mb-6">
                <div>
                  <label className="block text-gray-300 mb-2 text-sm sm:text-base">
                    You Pay ({orderType === 'buy' ? 'USDC' : 'WETH'})
                  </label>
                  <input
                    type="number"
                    value={sellAmount}
                    onChange={(e) => handleSellAmountChange(e.target.value)}
                    className="w-full bg-black/40 border-2 border-white/30 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-gray-400 focus:border-white/50 transition-colors text-sm sm:text-base"
                    placeholder="0.0"
                    step="any"
                  />
                </div>
                
                {/* Price indicator */}
                <div className="flex items-center justify-center py-2">
                  <div className="text-gray-400 text-xs sm:text-sm glass-card px-3 py-1 rounded-full">
                    ≈ 1 ETH = ${ethPrice.toLocaleString()} USDC
                  </div>
                </div>
                
                <div>
                  <label className="block text-gray-300 mb-2 text-sm sm:text-base">
                    You Receive ({orderType === 'buy' ? 'WETH' : 'USDC'}) 
                    <span className="text-green-400 text-xs ml-2">✓ Auto-calculated</span>
                  </label>
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => handleBuyAmountChange(e.target.value)}
                    className="w-full bg-black/40 border-2 border-white/30 rounded-lg px-3 sm:px-4 py-2 sm:py-3 text-white placeholder-gray-400 focus:border-white/50 transition-colors text-sm sm:text-base"
                    placeholder="0.0"
                    step="any"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handleApprove(orderType === 'buy' ? contractAddresses.usdc : contractAddresses.weth)}
                  className="w-full sm:w-auto sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 sm:py-3 px-4 rounded-lg transition-colors border border-blue-400/50 text-sm sm:text-base"
                >
                  Approve {orderType === 'buy' ? 'USDC' : 'WETH'}
                </button>
                
                <button
                  onClick={handleMintTokens}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 sm:py-3 px-4 rounded-lg transition-colors border border-green-400/50 text-sm sm:text-base"
                >
                  🪙 Get Test Tokens (10 WETH + 10,000 USDC)
                </button>
                
                <button
                  onClick={handleCreateOrder}
                  disabled={loading || !sellAmount || !buyAmount}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 sm:py-3 px-4 rounded-lg transition-colors border border-purple-400/50 text-sm sm:text-base"
                >
                  {loading ? 'Creating Order...' : 'Create Limit Order'}
                </button>
              </div>
            </div>

            {/* Account Info */}
            <div className="glass-card-prominent rounded-2xl p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 sm:mb-6">Account</h2>
              
              <div className="space-y-3 sm:space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm sm:text-base">Address:</span>
                  <span className="text-white font-mono text-xs sm:text-sm break-all sm:break-normal ml-2">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm sm:text-base">ETH Price:</span>
                  <span className="text-green-400 font-medium text-sm sm:text-base">
                    ${ethPrice.toLocaleString()}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm sm:text-base">WETH Balance:</span>
                  <span className="text-white text-sm sm:text-base">
                    {wethBalance ? formatEther(wethBalance) : '0.0'} WETH
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-300 text-sm sm:text-base">USDC Balance:</span>
                  <span className="text-white text-sm sm:text-base">
                    {usdcBalance ? formatEther(usdcBalance) : '0.0'} USDC
                  </span>
                </div>
              </div>

              {/* Network Info */}
              <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/20">
                <h3 className="text-base sm:text-lg font-semibold text-white mb-3">Network</h3>
                <div className="glass-card rounded-lg p-3 border-green-500/30">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-green-400 font-medium text-sm sm:text-base">Sepolia Testnet</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </StarsBackground>
  )
} 