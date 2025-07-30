import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import {
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  ArrowTrendingUpIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

export default function Home() {
  const { address } = useAccount();
  const { socket, isConnected } = useSocket();
  const [stats, setStats] = useState({
    totalVolume: '0',
    activeOrders: 0,
    completedTrades: 0,
    crossChainTrades: 0
  });
  const [recentTrades, setRecentTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Fetch user stats
        if (address) {
          const [userStats, userTrades] = await Promise.all([
            api.get(`/api/trades/stats/${address}`),
            api.get(`/api/trades/${address}?limit=5`)
          ]);
          
          setStats(userStats.data);
          setRecentTrades(userTrades.data);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [address]);

  // Listen for real-time updates
  useEffect(() => {
    if (socket && isConnected) {
      socket.on('trade_executed', (trade) => {
        if (trade.buyOrder?.userAddress === address || trade.sellOrder?.userAddress === address) {
          setRecentTrades(prev => [trade, ...prev.slice(0, 4)]);
          setStats(prev => ({
            ...prev,
            completedTrades: prev.completedTrades + 1
          }));
        }
      });

      return () => {
        socket.off('trade_executed');
      };
    }
  }, [socket, isConnected, address]);

  const statCards = [
    {
      name: 'Total Volume',
      value: `$${parseFloat(stats.totalVolume).toLocaleString()}`,
      icon: CurrencyDollarIcon,
      color: 'text-success-600',
      bgColor: 'bg-success-50',
    },
    {
      name: 'Active Orders',
      value: stats.activeOrders.toString(),
      icon: ClockIcon,
      color: 'text-warning-600',
      bgColor: 'bg-warning-50',
    },
    {
      name: 'Completed Trades',
      value: stats.completedTrades.toString(),
      icon: ChartBarIcon,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
    {
      name: 'Cross-Chain Trades',
      value: stats.crossChainTrades.toString(),
      icon: GlobeAltIcon,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="card">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to Crossline
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Your cross-chain trading dashboard
        </p>
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500' : 'bg-danger-500'}`}></div>
          <span>{isConnected ? 'Real-time updates active' : 'Connecting...'}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <div key={stat.name} className="card">
            <div className="flex items-center">
              <div className={`${stat.bgColor} p-3 rounded-lg`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Trades */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Recent Trades</h2>
            <Link 
              to="/history" 
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View all
            </Link>
          </div>
          
          {recentTrades.length > 0 ? (
            <div className="space-y-4">
              {recentTrades.map((trade, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                      <ArrowTrendingUpIcon className="h-4 w-4 text-primary-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {trade.sellToken?.symbol} → {trade.buyToken?.symbol}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(trade.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {parseFloat(trade.sellAmount).toFixed(4)}
                    </div>
                    <div className="text-xs text-success-600">
                      +${parseFloat(trade.value || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <ChartBarIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No trades yet</p>
              <Link to="/trading" className="btn-primary">
                Start Trading
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Quick Actions</h2>
          
          <div className="space-y-4">
            <Link 
              to="/trading" 
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors duration-200"
            >
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-4">
                <SparklesIcon className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Create Limit Order</div>
                <div className="text-sm text-gray-500">Place a new gasless limit order</div>
              </div>
            </Link>

            <Link 
              to="/orders" 
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors duration-200"
            >
              <div className="w-10 h-10 bg-warning-100 rounded-lg flex items-center justify-center mr-4">
                <ClockIcon className="h-5 w-5 text-warning-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Manage Orders</div>
                <div className="text-sm text-gray-500">View and cancel your orders</div>
              </div>
            </Link>

            <Link 
              to="/history" 
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors duration-200"
            >
              <div className="w-10 h-10 bg-success-100 rounded-lg flex items-center justify-center mr-4">
                <ChartBarIcon className="h-5 w-5 text-success-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">Trade History</div>
                <div className="text-sm text-gray-500">Review your completed trades</div>
              </div>
            </Link>
          </div>

          {/* Feature highlights */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Why Crossline?</h3>
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-success-500 rounded-full mr-2"></div>
                Gasless limit orders
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-primary-500 rounded-full mr-2"></div>
                Cross-chain execution
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <div className="w-2 h-2 bg-warning-500 rounded-full mr-2"></div>
                MEV protection
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 