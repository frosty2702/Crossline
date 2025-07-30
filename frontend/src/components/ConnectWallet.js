import React, { useState } from 'react';
import { useConnect, useAccount } from 'wagmi';
import { 
  WalletIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon 
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function ConnectWallet() {
  const [isConnecting, setIsConnecting] = useState(false);
  const { connect, connectors, error, isLoading, pendingConnector } = useConnect({
    onSuccess() {
      toast.success('Wallet connected successfully!');
      setIsConnecting(false);
    },
    onError(error) {
      toast.error(`Connection failed: ${error.message}`);
      setIsConnecting(false);
    },
  });
  const { isConnected } = useAccount();

  const handleConnect = async (connector) => {
    setIsConnecting(true);
    try {
      await connect({ connector });
    } catch (err) {
      setIsConnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="flex items-center text-success-600">
        <CheckCircleIcon className="h-5 w-5 mr-2" />
        <span className="text-sm font-medium">Connected</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="card">
        <div className="text-center mb-6">
          <WalletIcon className="mx-auto h-12 w-12 text-primary-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Connect Your Wallet
          </h3>
          <p className="text-sm text-gray-600">
            Connect your wallet to start trading on Crossline
          </p>
        </div>

        <div className="space-y-3">
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => handleConnect(connector)}
              disabled={!connector.ready || isLoading}
              className={`
                w-full flex items-center justify-between p-4 border rounded-lg transition-all duration-200
                ${!connector.ready 
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                  : 'border-gray-300 hover:border-primary-500 hover:bg-primary-50 cursor-pointer'
                }
                ${isLoading && connector.id === pendingConnector?.id 
                  ? 'border-primary-500 bg-primary-50' 
                  : ''
                }
              `}
            >
              <div className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center mr-3">
                  <WalletIcon className="h-4 w-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">
                    {connector.name}
                  </div>
                  {!connector.ready && (
                    <div className="text-sm text-gray-500">Not installed</div>
                  )}
                </div>
              </div>
              
              {isLoading && connector.id === pendingConnector?.id ? (
                <div className="loading-spinner"></div>
              ) : (
                <div className="text-sm text-gray-400">Connect</div>
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-danger-600 mr-2" />
              <div className="text-sm text-danger-700">
                {error.message}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-xs text-gray-500 text-center">
          By connecting your wallet, you agree to our Terms of Service and acknowledge 
          that you have read our Privacy Policy.
        </div>
      </div>
    </div>
  );
} 