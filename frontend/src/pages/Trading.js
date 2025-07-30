import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { 
  ArrowsRightLeftIcon,
  ChevronDownIcon,
  InformationCircleIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { useContracts } from '../context/ContractsContext';
import { useSocket } from '../context/SocketContext';
import { orderApi, orderbookApi } from '../services/api';
import toast from 'react-hot-toast';

export default function Trading() {
  const { address } = useAccount();
  const { tokens, currentChain, getSupportedChains } = useContracts();
  const { socket, isConnected } = useSocket();
  
  // Form state
  const [formData, setFormData] = useState({
    sellToken: 'WETH',
    buyToken: 'USDC',
    sellAmount: '',
    buyAmount: '',
    sourceChain: currentChain?.id || 31337,
    targetChain: currentChain?.id || 31337,
    expiry: 24, // hours
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [orderbook, setOrderbook] = useState({ bids: [], asks: [] });
  const [orderbookLoading, setOrderbookLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const tokenOptions = Object.entries(tokens).map(([symbol, token]) => ({
    symbol,
    ...token
  }));
  
  const supportedChains = getSupportedChains();

  // Fetch order book
  useEffect(() => {
    const fetchOrderbook = async () => {
      if (!formData.sellToken || !formData.buyToken) return;
      
      try {
        setOrderbookLoading(true);
        const tokenPair = `${formData.sellToken}-${formData.buyToken}`;
        const response = await orderbookApi.getOrderbook(tokenPair);
        setOrderbook(response.data);
      } catch (error) {
        console.error('Error fetching orderbook:', error);
      } finally {
        setOrderbookLoading(false);
      }
    };

    fetchOrderbook();
  }, [formData.sellToken, formData.buyToken]);

  // Handle form changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Swap tokens
  const handleSwapTokens = () => {
    setFormData(prev => ({
      ...prev,
      sellToken: prev.buyToken,
      buyToken: prev.sellToken,
      sellAmount: prev.buyAmount,
      buyAmount: prev.sellAmount,
    }));
  };

  // Calculate price impact
  const calculatePrice = () => {
    if (!formData.sellAmount || !formData.buyAmount) return 0;
    return parseFloat(formData.buyAmount) / parseFloat(formData.sellAmount);
  };

  // Handle order submission
  const handleSubmitOrder = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    if (!formData.sellAmount || !formData.buyAmount) {
      toast.error('Please enter both amounts');
      return;
    }

    try {
      setLoading(true);
      
      // Calculate expiry timestamp
      const expiryTimestamp = Math.floor(Date.now() / 1000) + (formData.expiry * 3600);
      
      // Generate nonce (simplified)
      const nonce = Date.now();
      
      // Create order object
      const order = {
        userAddress: address,
        sellToken: tokens[formData.sellToken]?.address || formData.sellToken,
        buyToken: tokens[formData.buyToken]?.address || formData.buyToken,
        sellAmount: formData.sellAmount,
        buyAmount: formData.buyAmount,
        sourceChain: formData.sourceChain,
        targetChain: formData.targetChain,
        expiry: expiryTimestamp,
        nonce: nonce,
      };

      // For demo purposes, use a mock signature
      // In production, you would sign with the user's wallet
      const mockSignature = '0x' + '00'.repeat(65);

      // Submit order
      await orderApi.submitOrder({
        ...order,
        signature: mockSignature
      });

      toast.success('Order submitted successfully!');
      
      // Reset form
      setFormData(prev => ({
        ...prev,
        sellAmount: '',
        buyAmount: '',
      }));

    } catch (error) {
      console.error('Error submitting order:', error);
      toast.error('Failed to submit order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Create Limit Order
        </h1>
        <p className="text-lg text-gray-600">
          Place gasless limit orders across chains
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Order Form */}
        <div className="lg:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Order Details</h2>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500' : 'bg-danger-500'}`}></div>
                <span>Real-time pricing</span>
              </div>
            </div>

            {/* Token Selection */}
            <div className="space-y-4">
              {/* Sell Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  You're selling
                </label>
                <div className="relative">
                  <select
                    value={formData.sellToken}
                    onChange={(e) => handleInputChange('sellToken', e.target.value)}
                    className="input-field pr-10 appearance-none"
                  >
                    {tokenOptions.map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.symbol} - {token.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  placeholder="0.0"
                  value={formData.sellAmount}
                  onChange={(e) => handleInputChange('sellAmount', e.target.value)}
                  className="input-field mt-2"
                />
              </div>

              {/* Swap Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleSwapTokens}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                >
                  <ArrowsRightLeftIcon className="h-5 w-5 text-gray-600" />
                </button>
              </div>

              {/* Buy Token */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  You're buying
                </label>
                <div className="relative">
                  <select
                    value={formData.buyToken}
                    onChange={(e) => handleInputChange('buyToken', e.target.value)}
                    className="input-field pr-10 appearance-none"
                  >
                    {tokenOptions.map((token) => (
                      <option key={token.symbol} value={token.symbol}>
                        {token.symbol} - {token.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  placeholder="0.0"
                  value={formData.buyAmount}
                  onChange={(e) => handleInputChange('buyAmount', e.target.value)}
                  className="input-field mt-2"
                />
              </div>
            </div>

            {/* Advanced Options */}
            <div className="mt-6">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center text-sm text-primary-600 hover:text-primary-700"
              >
                Advanced Options
                <ChevronDownIcon className={`ml-1 h-4 w-4 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

              {showAdvanced && (
                <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
                  {/* Cross-chain options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Source Chain
                      </label>
                      <select
                        value={formData.sourceChain}
                        onChange={(e) => handleInputChange('sourceChain', parseInt(e.target.value))}
                        className="input-field"
                      >
                        {supportedChains.map((chain) => (
                          <option key={chain.chainId} value={chain.chainId}>
                            {chain.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target Chain
                      </label>
                      <select
                        value={formData.targetChain}
                        onChange={(e) => handleInputChange('targetChain', parseInt(e.target.value))}
                        className="input-field"
                      >
                        {supportedChains.map((chain) => (
                          <option key={chain.chainId} value={chain.chainId}>
                            {chain.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Expiry */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Expiry (hours)
                    </label>
                    <select
                      value={formData.expiry}
                      onChange={(e) => handleInputChange('expiry', parseInt(e.target.value))}
                      className="input-field"
                    >
                      <option value={1}>1 hour</option>
                      <option value={6}>6 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={168}>1 week</option>
                      <option value={720}>1 month</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary */}
            {formData.sellAmount && formData.buyAmount && (
              <div className="mt-6 p-4 bg-primary-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Order Summary</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Price:</span>
                    <span>{calculatePrice().toFixed(6)} {formData.buyToken}/{formData.sellToken}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Network Fee:</span>
                    <span className="text-success-600">Free (Gasless)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cross-chain:</span>
                    <span>{formData.sourceChain !== formData.targetChain ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmitOrder}
              disabled={loading || !formData.sellAmount || !formData.buyAmount}
              className="w-full btn-primary mt-6 flex items-center justify-center"
            >
              {loading ? (
                <div className="loading-spinner mr-2"></div>
              ) : (
                <SparklesIcon className="h-5 w-5 mr-2" />
              )}
              {loading ? 'Creating Order...' : 'Create Limit Order'}
            </button>

            {/* Info */}
            <div className="mt-4 flex items-start space-x-2 text-sm text-gray-500">
              <InformationCircleIcon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>
                Your order will be executed automatically when market conditions are met. 
                No gas fees are required for order creation.
              </p>
            </div>
          </div>
        </div>

        {/* Order Book */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Order Book: {formData.sellToken}/{formData.buyToken}
          </h2>

          {orderbookLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-6 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Asks (Sell Orders) */}
              <div>
                <h3 className="text-sm font-medium text-danger-600 mb-2">
                  Asks ({orderbook.asks?.length || 0})
                </h3>
                <div className="space-y-1">
                  {orderbook.asks?.slice(0, 5).map((ask, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-danger-600">{parseFloat(ask.price).toFixed(6)}</span>
                      <span className="text-gray-600">{parseFloat(ask.amount).toFixed(4)}</span>
                    </div>
                  )) || <div className="text-sm text-gray-500">No asks</div>}
                </div>
              </div>

              {/* Spread */}
              <div className="border-t border-b border-gray-200 py-2">
                <div className="text-center text-sm text-gray-500">
                  Spread: {orderbook.spread ? `${(orderbook.spread * 100).toFixed(2)}%` : 'N/A'}
                </div>
              </div>

              {/* Bids (Buy Orders) */}
              <div>
                <h3 className="text-sm font-medium text-success-600 mb-2">
                  Bids ({orderbook.bids?.length || 0})
                </h3>
                <div className="space-y-1">
                  {orderbook.bids?.slice(0, 5).map((bid, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-success-600">{parseFloat(bid.price).toFixed(6)}</span>
                      <span className="text-gray-600">{parseFloat(bid.amount).toFixed(4)}</span>
                    </div>
                  )) || <div className="text-sm text-gray-500">No bids</div>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 