import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { 
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  GlobeAltIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useContracts } from '../context/ContractsContext';
import { tradeApi } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export default function History() {
  const { address } = useAccount();
  const { getTokenByAddress, getChainInfo } = useContracts();
  
  const [trades, setTrades] = useState([]);
  const [stats, setStats] = useState({
    totalTrades: 0,
    totalVolume: '0',
    successRate: 0,
    crossChainTrades: 0
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState('all');
  const [selectedTrade, setSelectedTrade] = useState(null);

  // Fetch user trades and stats
  useEffect(() => {
    const fetchData = async () => {
      if (!address) return;
      
      try {
        setLoading(true);
        const [tradesResponse, statsResponse] = await Promise.all([
          tradeApi.getUserTrades(address),
          tradeApi.getUserStats(address)
        ]);
        
        setTrades(tradesResponse.data);
        setStats(statsResponse.data);
      } catch (error) {
        console.error('Error fetching trade history:', error);
        toast.error('Failed to load trade history');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [address]);

  // Filter trades based on search and time
  const filteredTrades = trades.filter(trade => {
    const matchesSearch = search === '' || 
      trade.sellToken?.symbol.toLowerCase().includes(search.toLowerCase()) ||
      trade.buyToken?.symbol.toLowerCase().includes(search.toLowerCase());
    
    let matchesTime = true;
    if (timeFilter !== 'all') {
      const tradeDate = new Date(trade.executedAt);
      const now = new Date();
      const diffDays = (now - tradeDate) / (1000 * 60 * 60 * 24);
      
      switch (timeFilter) {
        case '24h':
          matchesTime = diffDays <= 1;
          break;
        case '7d':
          matchesTime = diffDays <= 7;
          break;
        case '30d':
          matchesTime = diffDays <= 30;
          break;
        default:
          matchesTime = true;
      }
    }
    
    return matchesSearch && matchesTime;
  });

  // Format amount for display
  const formatAmount = (amount, decimals = 18) => {
    return parseFloat(amount).toFixed(4);
  };

  // Format volume for display
  const formatVolume = (volume) => {
    const num = parseFloat(volume);
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
  };

  // Calculate trade value (simplified)
  const calculateTradeValue = (trade) => {
    // In a real app, you'd fetch token prices from an API
    return parseFloat(trade.sellAmount) * 2000; // Mock: assume 1 token = $2000
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card">
              <div className="h-4 bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Trade History</h1>
        <p className="text-gray-600 mt-1">
          Review your completed trades and performance statistics
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="bg-primary-50 p-3 rounded-lg">
              <ChartBarIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Trades</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTrades}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="bg-success-50 p-3 rounded-lg">
              <ArrowTrendingUpIcon className="h-6 w-6 text-success-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Volume</p>
              <p className="text-2xl font-bold text-gray-900">{formatVolume(stats.totalVolume)}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="bg-warning-50 p-3 rounded-lg">
              <ArrowTrendingDownIcon className="h-6 w-6 text-warning-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.successRate}%</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="bg-purple-50 p-3 rounded-lg">
              <GlobeAltIcon className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Cross-Chain</p>
              <p className="text-2xl font-bold text-gray-900">{stats.crossChainTrades}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by token..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Time Filter */}
          <div className="flex items-center space-x-2">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Trades Table */}
      <div className="card overflow-hidden">
        {filteredTrades.length === 0 ? (
          <div className="text-center py-12">
            <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No trades found</h3>
            <p className="text-gray-500">
              {search || timeFilter !== 'all' 
                ? 'No trades match your current filters' 
                : 'You haven\'t completed any trades yet'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Chain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTrades.map((trade) => (
                  <tr 
                    key={trade._id} 
                    className="table-row cursor-pointer"
                    onClick={() => setSelectedTrade(trade)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                          <ArrowTrendingUpIcon className="h-4 w-4 text-primary-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {trade.sellToken?.symbol} → {trade.buyToken?.symbol}
                          </div>
                          <div className="text-xs text-gray-500">
                            Match ID: {trade.matchId?.slice(0, 8)}...
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatAmount(trade.sellAmount)} {trade.sellToken?.symbol}
                      </div>
                      <div className="text-xs text-gray-500">
                        → {formatAmount(trade.buyAmount)} {trade.buyToken?.symbol}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {(parseFloat(trade.buyAmount) / parseFloat(trade.sellAmount)).toFixed(6)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {trade.buyToken?.symbol}/{trade.sellToken?.symbol}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-success-600">
                        ${calculateTradeValue(trade).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {trade.sourceChain !== trade.targetChain ? (
                          <div className="flex items-center text-purple-600">
                            <GlobeAltIcon className="h-4 w-4 mr-1" />
                            <span className="text-xs">Cross-chain</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600">
                            {getChainInfo(trade.sourceChain).shortName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(trade.executedAt), 'MMM dd, HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="status-filled">
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trade Details Modal */}
      {selectedTrade && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Trade Details</h3>
              <button
                onClick={() => setSelectedTrade(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Match ID</label>
                <p className="font-mono text-sm">{selectedTrade.matchId}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Sold</label>
                  <p>{formatAmount(selectedTrade.sellAmount)} {selectedTrade.sellToken?.symbol}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Bought</label>
                  <p>{formatAmount(selectedTrade.buyAmount)} {selectedTrade.buyToken?.symbol}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">Trade Value</label>
                <p className="text-lg font-semibold text-success-600">
                  ${calculateTradeValue(selectedTrade).toLocaleString()}
                </p>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">Executed At</label>
                <p>{format(new Date(selectedTrade.executedAt), 'MMM dd, yyyy HH:mm:ss')}</p>
              </div>
              
              {selectedTrade.txHash && (
                <div>
                  <label className="text-sm text-gray-500">Transaction Hash</label>
                  <p className="font-mono text-xs break-all">{selectedTrade.txHash}</p>
                </div>
              )}
              
              {selectedTrade.sourceChain !== selectedTrade.targetChain && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center text-purple-700">
                    <GlobeAltIcon className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">Cross-Chain Trade</span>
                  </div>
                  <p className="text-sm text-purple-600 mt-1">
                    Executed from chain {selectedTrade.sourceChain} to {selectedTrade.targetChain}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 