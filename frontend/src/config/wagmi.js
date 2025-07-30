import { configureChains, createConfig } from 'wagmi';
import { mainnet, polygon, arbitrum, sepolia, hardhat } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { InjectedConnector } from 'wagmi/connectors/injected';

// Configure chains and providers
const { chains, publicClient, webSocketPublicClient } = configureChains(
  [
    hardhat,
    sepolia, 
    mainnet,
    polygon,
    arbitrum,
  ],
  [publicProvider()]
);

// Create wagmi config
export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [
    new MetaMaskConnector({ chains }),
    new InjectedConnector({
      chains,
      options: {
        name: 'Browser Wallet',
        shimDisconnect: true,
      },
    }),
    new WalletConnectConnector({
      chains,
      options: {
        projectId: process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
      },
    }),
  ],
  publicClient,
  webSocketPublicClient,
});

export { chains }; 