import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    // Connection event handlers
    socketInstance.on('connect', () => {
      console.log('Connected to backend socket');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Disconnected from backend socket:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        socketInstance.connect();
      }
    });

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
    });

    // Trading event handlers
    socketInstance.on('order_created', (order) => {
      toast.success(`Order created: ${order.sellAmount} ${order.sellToken.symbol} → ${order.buyToken.symbol}`);
    });

    socketInstance.on('order_matched', (match) => {
      toast.info(`Order matched! Match ID: ${match.matchId.slice(0, 8)}...`);
    });

    socketInstance.on('trade_executed', (trade) => {
      toast.success(`Trade executed: ${trade.sellAmount} ${trade.sellToken.symbol} → ${trade.buyAmount} ${trade.buyToken.symbol}`);
    });

    socketInstance.on('order_cancelled', (order) => {
      toast.info(`Order cancelled: ${order.orderId.slice(0, 8)}...`);
    });

    socketInstance.on('cross_chain_match', (data) => {
      toast.info(`Cross-chain match initiated: ${data.sourceChain} → ${data.targetChain}`);
    });

    socketInstance.on('error', (error) => {
      console.error('Socket error:', error);
      toast.error('Real-time connection error');
    });

    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const value = {
    socket,
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}; 