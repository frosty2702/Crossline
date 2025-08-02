import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia, hardhat } from 'wagmi/chains'

// Custom Sepolia with reliable RPC
const sepoliaCustom = {
  ...sepolia,
  rpcUrls: {
    default: {
      http: ['https://sepolia.drpc.org'],
    },
  },
}

// Custom Monad Testnet chain definition
const monadTestnet = {
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: {
      http: ['https://testnet-rpc.monad.xyz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet-explorer.monad.xyz',
    },
  },
  testnet: true,
} as const

export const config = getDefaultConfig({
  appName: 'Crossline - Gasless Cross-Chain Limit Orders',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // Get from https://cloud.walletconnect.com
  chains: [hardhat, sepoliaCustom, monadTestnet],
  ssr: true,
}) 