import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, polygon, arbitrum, sepolia, hardhat } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'Crossline - Gasless Cross-Chain Limit Orders',
  projectId: 'YOUR_WALLETCONNECT_PROJECT_ID', // Get from https://cloud.walletconnect.com
  chains: [hardhat, sepolia, mainnet, polygon, arbitrum],
  ssr: true,
}) 