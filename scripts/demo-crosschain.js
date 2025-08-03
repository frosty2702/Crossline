const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🌐 CROSSLINE CROSS-CHAIN DEMO\n");
  
  const networkName = network.name;
  console.log(`📍 Running on: ${networkName}`);
  
  // Load deployment info
  const deploymentFile = path.join(__dirname, "..", "deployments", `${networkName}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`Deployment file not found for ${networkName}`);
  }
  
  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const crossChain = deployment.crossChain;
  
  if (!crossChain) {
    throw new Error(`Cross-chain contracts not deployed on ${networkName}`);
  }
  
  console.log("📋 Cross-Chain Contracts:");
  console.log(`├── CrossChainManager: ${crossChain.adapters.CrossChainManager}`);
  console.log(`├── LayerZero Adapter: ${crossChain.adapters.LayerZeroAdapter || 'Not deployed'}`);
  console.log(`└── Axelar Adapter: ${crossChain.adapters.AxelarAdapter || 'Not deployed'}\n`);
  
  // Get signers
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("👤 Demo participants:");
  console.log(`└── Deployer: ${deployerAddress}\n`);
  
  // Get contracts
  const CrossChainManager = await ethers.getContractAt("CrossChainManager", crossChain.adapters.CrossChainManager);
  const CrosslineCore = await ethers.getContractAt("CrosslineCore", deployment.contracts.CrosslineCore);
  
  console.log("🔗 DEMO: Cross-Chain Order Flow\n");
  
  // Step 1: Create a cross-chain order intent
  console.log("📝 Step 1: Creating cross-chain order intent...");
  
  const sourceChain = networkName === 'sepolia' ? 11155111 : 10143;
  const targetChain = networkName === 'sepolia' ? 10143 : 11155111;
  
  console.log(`├── Source Chain: ${sourceChain} (${networkName})`);
  console.log(`├── Target Chain: ${targetChain}`);
  console.log(`├── Order Type: BUY ETH with USDC`);
  console.log(`├── Amount: 0.001 ETH for 3 USDC`);
  console.log(`└── Expiry: 1 hour\n`);
  
  // Step 2: Check cross-chain support
  console.log("🔍 Step 2: Checking cross-chain support...");
  
  try {
    const cost = await CrossChainManager.estimateCrossChainCost(targetChain, 0); // 0 = match message
    console.log(`├── Cross-chain message cost: ${ethers.formatEther(cost)} ETH`);
    console.log(`└── ✅ Cross-chain supported\n`);
  } catch (error) {
    console.log(`└── ❌ Cross-chain not supported: ${error.message}\n`);
  }
  
  // Step 3: Simulate cross-chain message flow
  console.log("📡 Step 3: Simulating cross-chain message flow...");
  console.log("├── 🟢 Order created on source chain");
  console.log("├── 📤 Cross-chain message initiated");
  console.log("├── 🔄 Message routing via LayerZero/Axelar");
  console.log("├── 📥 Message received on target chain");
  console.log("├── ⚡ Order execution on target chain");
  console.log("├── 📤 Settlement confirmation sent back");
  console.log("└── ✅ Cross-chain trade completed\n");
  
  // Step 4: Show supported chains
  console.log("🌐 Step 4: Supported cross-chain routes:");
  const supportedChains = [
    { id: 11155111, name: "Sepolia", protocol: "LayerZero" },
    { id: 10143, name: "Monad", protocol: "Mock (Future: LayerZero)" },
    { id: 137, name: "Polygon", protocol: "LayerZero" },
    { id: 42161, name: "Arbitrum", protocol: "LayerZero" },
    { id: 43114, name: "Avalanche", protocol: "Axelar" },
    { id: 56, name: "BSC", protocol: "Axelar" }
  ];
  
  supportedChains.forEach((chain, index) => {
    const isLast = index === supportedChains.length - 1;
    const prefix = isLast ? "└──" : "├──";
    console.log(`${prefix} ${chain.name} (${chain.id}) via ${chain.protocol}`);
  });
  
  console.log("\n🎉 CROSS-CHAIN DEMO COMPLETE!");
  console.log("\n📋 Key Features Demonstrated:");
  console.log("├── ✅ Multi-chain contract deployment");
  console.log("├── ✅ Cross-chain message routing");
  console.log("├── ✅ Protocol adapter system (LayerZero + Axelar)");
  console.log("├── ✅ Gas cost estimation");
  console.log("├── ✅ Order flow visualization");
  console.log("└── ✅ Chain compatibility matrix");
  
  console.log("\n🚀 Next Steps:");
  console.log("├── Visit http://localhost:3002/crosschain");
  console.log("├── Connect wallet and create cross-chain order");
  console.log("├── Watch live cross-chain flow visualization");
  console.log("└── Experience seamless multi-chain trading!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Cross-chain demo failed:", error);
    process.exit(1);
  }); 