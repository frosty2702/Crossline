import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { 
  ClockIcon,
  XMarkIcon,
  EyeIcon,
  FunnelIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { useContracts } from '../context/ContractsContext';
import { useSocket } from '../context/SocketContext';
import { orderApi } from '../services/api';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ORDER_STATUS = {
  Open: 'status-open',
  Matched: 'status-matched', 
  PartiallyFilled: 'status-matched',
  Filled: 'status-filled',
  Cancelled: 'status-cancelled',
  Expired: 'status-cancelled'
};

export default function Orders() {
  const { address } = useAccount();
  const { getTokenByAddress } = useContracts();
  const { socket, isConnected } = useSocket();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [cancelling, setCancelling] = useState(new Set());

  // Fetch user orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (!address) return;
      
      try {
        setLoading(true);
        const response = await orderApi.getUserOrders(address);
        setOrders(response.data);
      } catch (error) {
        console.error('Error fetching orders:', error);
        toast.error('Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [address]);

  // Listen for real-time order updates
  useEffect(() => {
    if (socket && isConnected && address) {
      socket.on('order_updated', (updatedOrder) => {
        if (updatedOrder.userAddress === address) {
          setOrders(prev => prev.map(order => 
            order._id === updatedOrder._id ? updatedOrder : order
          ));
        }
      });

      socket.on('order_matched', (match) => {
        // Update orders involved in the match
        setOrders(prev => prev.map(order => {
          if (order._id === match.buyOrderId || order._id === match.sellOrderId) {
            return { ...order, status: 'Matched' };
          }
          return order;
        }));
      });

      return () => {
        socket.off('order_updated');
        socket.off('order_matched');
      };
    }
  }, [socket, isConnected, address]);

  // Handle order cancellation
  const handleCancelOrder = async (orderId) => {
    try {
      setCancelling(prev => new Set(prev).add(orderId));
      
      // For demo purposes, use mock signature
      // In production, sign the cancellation with user's wallet
      const mockSignature = '0x' + '00'.repeat(65);
      
      await orderApi.cancelOrder(orderId, mockSignature);
      
      // Update local state
      setOrders(prev => prev.map(order => 
        order._id === orderId ? { ...order, status: 'Cancelled' } : order
      ));
      
      toast.success('Order cancelled successfully');
    } catch (error) {
      console.error('Error cancelling order:', error);
      toast.error('Failed to cancel order');
    } finally {
      setCancelling(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  // Filter orders based on status and search
  const filteredOrders = orders.filter(order => {
    const matchesFilter = filter === 'all' || order.status.toLowerCase() === filter.toLowerCase();
    const matchesSearch = search === '' || 
      order.sellToken.symbol.toLowerCase().includes(search.toLowerCase()) ||
      order.buyToken.symbol.toLowerCase().includes(search.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  // Format token amount for display
  const formatAmount = (amount, decimals = 18) => {
    return parseFloat(amount).toFixed(4);
  };

  // Calculate order price
  const calculatePrice = (order) => {
    return parseFloat(order.buyAmount) / parseFloat(order.sellAmount);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-600 mt-1">
            Manage your limit orders and track their status
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500' : 'bg-danger-500'}`}></div>
          <span>Real-time updates</span>
        </div>
      </div>

      {/* Filters and Search */}
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

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <FunnelIcon className="h-5 w-5 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Orders</option>
              <option value="open">Open</option>
              <option value="matched">Matched</option>
              <option value="filled">Filled</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <ClockIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500">
              {search || filter !== 'all' 
                ? 'No orders match your current filters' 
                : 'You haven\'t created any orders yet'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Token Pair
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((order) => (
                  <tr key={order._id} className="table-row">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {order.sellToken.symbol}/{order.buyToken.symbol}
                          </div>
                          {order.sourceChain !== order.targetChain && (
                            <div className="text-xs text-purple-600">Cross-chain</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">Limit</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatAmount(order.sellAmount)} {order.sellToken.symbol}
                      </div>
                      <div className="text-xs text-gray-500">
                        → {formatAmount(order.buyAmount)} {order.buyToken.symbol}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {calculatePrice(order).toFixed(6)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.buyToken.symbol}/{order.sellToken.symbol}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={ORDER_STATUS[order.status] || 'status-open'}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(order.createdAt), 'MMM dd, HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        {(order.status === 'Open' || order.status === 'Matched') && (
                          <button
                            onClick={() => handleCancelOrder(order._id)}
                            disabled={cancelling.has(order._id)}
                            className="text-danger-600 hover:text-danger-900 disabled:opacity-50"
                          >
                            {cancelling.has(order._id) ? (
                              <div className="h-4 w-4 animate-spin border border-danger-600 border-t-transparent rounded-full"></div>
                            ) : (
                              <XMarkIcon className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Order Details</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">Order ID</label>
                <p className="font-mono text-sm">{selectedOrder._id}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Sell Token</label>
                  <p>{selectedOrder.sellToken.symbol}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Buy Token</label>
                  <p>{selectedOrder.buyToken.symbol}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-500">Sell Amount</label>
                  <p>{formatAmount(selectedOrder.sellAmount)}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Buy Amount</label>
                  <p>{formatAmount(selectedOrder.buyAmount)}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <p>
                  <span className={ORDER_STATUS[selectedOrder.status] || 'status-open'}>
                    {selectedOrder.status}
                  </span>
                </p>
              </div>
              
              <div>
                <label className="text-sm text-gray-500">Expires At</label>
                <p>{format(new Date(selectedOrder.expiry * 1000), 'MMM dd, yyyy HH:mm')}</p>
              </div>
              
              {selectedOrder.sourceChain !== selectedOrder.targetChain && (
                <div className="p-3 bg-purple-50 rounded-lg">
                  <p className="text-sm text-purple-700">
                    This is a cross-chain order from chain {selectedOrder.sourceChain} to {selectedOrder.targetChain}
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