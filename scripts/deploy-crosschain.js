const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Cross-chain configuration
const CROSS_CHAIN_CONFIG = {
  localhost: {
    // For testing - use mock endpoints
    layerZero: {
      endpoint: "0x0000000000000000000000000000000000000000", // Mock for localhost
      deployed: false
    },
    axelar: {
      gateway: "0x0000000000000000000000000000000000000000", // Mock for localhost
      gasService: "0x0000000000000000000000000000000000000000", // Mock for localhost
      deployed: false
    }
  },
  sepolia: {
    layerZero: {
      endpoint: "0xae92d5aD7583AD66E49A0c67BAd18F6ba52dDDc1", // Sepolia LZ endpoint
      deployed: true
    },
    axelar: {
      gateway: "0xe432150cce91c13a887f7D836923d5597adD8E31", // Sepolia Axelar gateway
      gasService: "0xbE406F0189A0B4cf3A05C286473D23791Dd44Cc6", // Sepolia gas service
      deployed: true
    }
  },
  polygon: {
    layerZero: {
      endpoint: "0x3c2269811836af69497E5F486A85D7316753cf62", // Polygon LZ endpoint
      deployed: true
    },
    axelar: {
      gateway: "0x6f015F16De9fC8791b234eF68D486d2bF203FBA8", // Polygon Axelar gateway
      gasService: "0x2d5d7d31F671F86C782533cc367F14109a082712", // Polygon gas service
      deployed: true
    }
  },
  arbitrum: {
    layerZero: {
      endpoint: "0x3c2269811836af69497E5F486A85D7316753cf62", // Arbitrum LZ endpoint
      deployed: true
    },
    axelar: {
      gateway: "0xe432150cce91c13a887f7D836923d5597adD8E31", // Arbitrum Axelar gateway
      gasService: "0x2d5d7d31F671F86C782533cc367F14109a082712", // Arbitrum gas service
      deployed: true
    }
  },
  monadTestnet: {
    // Monad testnet - use mock endpoints for now since it's a new chain
    layerZero: {
      endpoint: "0x0000000000000000000000000000000000000000", // Mock for Monad (LZ not deployed yet)
      deployed: false
    },
    axelar: {
      gateway: "0x0000000000000000000000000000000000000000", // Mock for Monad (Axelar not deployed yet)
      gasService: "0x0000000000000000000000000000000000000000", // Mock for Monad
      deployed: false
    }
  }
};

async function main() {
  console.log("\n🌐 Starting Cross-Chain Adapters Deployment...\n");

  // Get network configuration
  const networkName = network.name;
  const config = CROSS_CHAIN_CONFIG[networkName];
  
  if (!config) {
    throw new Error(`Cross-chain configuration not found for network: ${networkName}`);
  }
  
  console.log(`📍 Deploying to: ${networkName}`);

  // Get deployment account
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const deployerBalance = await ethers.provider.getBalance(deployerAddress);
  
  console.log("👤 Deployer account:", deployerAddress);
  console.log("💰 Deployer balance:", ethers.formatEther(deployerBalance), "ETH\n");

  // Load existing deployment
  const deploymentFile = path.join(__dirname, "..", "deployments", `${networkName}.json`);
  let deployment = {};
  
  if (fs.existsSync(deploymentFile)) {
    deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
    console.log("📋 Loaded existing deployment");
  } else {
    throw new Error(`Base deployment not found. Run 'npm run deploy:${networkName}' first.`);
  }

  const crossChainDeployments = {};

  try {
    // Step 1: Deploy CrossChainManager
    console.log("📦 Step 1: Deploying CrossChainManager...");
    const CrossChainManager = await ethers.getContractFactory("CrossChainManager");
    const crossChainManager = await CrossChainManager.deploy(deployment.contracts.CrosslineCore);
    await crossChainManager.waitForDeployment();
    const crossChainManagerAddress = await crossChainManager.getAddress();
    
    console.log("✅ CrossChainManager deployed to:", crossChainManagerAddress);
    crossChainDeployments.CrossChainManager = crossChainManagerAddress;

    // Step 2: Deploy LayerZero Adapter (if supported)
    if (config.layerZero.deployed || networkName === "localhost") {
      console.log("\n📦 Step 2: Deploying LayerZero Adapter...");
      
      let lzEndpoint = config.layerZero.endpoint;
      
      // For localhost, deploy mock endpoint
      if (networkName === "localhost") {
        console.log("🔧 Deploying Mock LayerZero Endpoint for testing...");
        const MockLZEndpoint = await ethers.getContractFactory("MockLZEndpoint");
        const mockEndpoint = await MockLZEndpoint.deploy();
        await mockEndpoint.waitForDeployment();
        lzEndpoint = await mockEndpoint.getAddress();
        console.log("✅ Mock LZ Endpoint deployed to:", lzEndpoint);
        crossChainDeployments.MockLZEndpoint = lzEndpoint;
      }
      
      const LayerZeroAdapter = await ethers.getContractFactory("LayerZeroAdapter");
      const layerZeroAdapter = await LayerZeroAdapter.deploy(
        lzEndpoint,
        deployment.contracts.CrosslineCore
      );
      await layerZeroAdapter.waitForDeployment();
      const layerZeroAdapterAddress = await layerZeroAdapter.getAddress();
      
      console.log("✅ LayerZero Adapter deployed to:", layerZeroAdapterAddress);
      crossChainDeployments.LayerZeroAdapter = layerZeroAdapterAddress;
      
      // Register adapter with manager
      await crossChainManager.registerAdapter("LayerZero", layerZeroAdapterAddress);
      console.log("✅ LayerZero Adapter registered with CrossChainManager");
    }

    // Step 3: Deploy Axelar Adapter (if supported)
    if (config.axelar.deployed || networkName === "localhost") {
      console.log("\n📦 Step 3: Deploying Axelar Adapter...");
      
      let axelarGateway = config.axelar.gateway;
      let axelarGasService = config.axelar.gasService;
      
      // For localhost, deploy mock contracts
      if (networkName === "localhost") {
        console.log("🔧 Deploying Mock Axelar Contracts for testing...");
        
        const MockAxelarGateway = await ethers.getContractFactory("MockAxelarGateway");
        const mockGateway = await MockAxelarGateway.deploy();
        await mockGateway.waitForDeployment();
        axelarGateway = await mockGateway.getAddress();
        console.log("✅ Mock Axelar Gateway deployed to:", axelarGateway);
        crossChainDeployments.MockAxelarGateway = axelarGateway;
        
        const MockAxelarGasService = await ethers.getContractFactory("MockAxelarGasService");
        const mockGasService = await MockAxelarGasService.deploy();
        await mockGasService.waitForDeployment();
        axelarGasService = await mockGasService.getAddress();
        console.log("✅ Mock Axelar Gas Service deployed to:", axelarGasService);
        crossChainDeployments.MockAxelarGasService = axelarGasService;
      }
      
      const AxelarAdapter = await ethers.getContractFactory("AxelarAdapter");
      const axelarAdapter = await AxelarAdapter.deploy(
        axelarGateway,
        axelarGasService,
        deployment.contracts.CrosslineCore
      );
      await axelarAdapter.waitForDeployment();
      const axelarAdapterAddress = await axelarAdapter.getAddress();
      
      console.log("✅ Axelar Adapter deployed to:", axelarAdapterAddress);
      crossChainDeployments.AxelarAdapter = axelarAdapterAddress;
      
      // Register adapter with manager
      await crossChainManager.registerAdapter("Axelar", axelarAdapterAddress);
      console.log("✅ Axelar Adapter registered with CrossChainManager");
    }

    // Step 4: Configure Chain Mappings
    console.log("\n⚙️  Step 4: Configuring Chain Mappings...");
    
    // Set default adapters for common chains
    const chainMappings = [
      { chainId: 1, adapter: "LayerZero" },      // Ethereum
      { chainId: 137, adapter: "LayerZero" },    // Polygon  
      { chainId: 42161, adapter: "LayerZero" },  // Arbitrum
      { chainId: 11155111, adapter: "LayerZero" }, // Sepolia
      { chainId: 43114, adapter: "Axelar" },     // Avalanche (Axelar preferred)
      { chainId: 56, adapter: "Axelar" }         // BSC (Axelar preferred)
    ];
    
    for (const mapping of chainMappings) {
      try {
        const adapterAddress = crossChainDeployments[`${mapping.adapter}Adapter`];
        if (adapterAddress) {
          const tx = await crossChainManager.setChainAdapter(mapping.chainId, mapping.adapter);
          await tx.wait();
          console.log(`✅ Set ${mapping.adapter} as adapter for chain ${mapping.chainId}`);
        }
      } catch (error) {
        console.log(`⚠️  Could not set adapter for chain ${mapping.chainId}: ${error.message}`);
      }
    }

    // Step 5: Update Deployment File
    console.log("\n💾 Step 5: Updating Deployment Information...");
    
    // Add cross-chain deployments to existing deployment
    deployment.crossChain = {
      adapters: crossChainDeployments,
      configuration: {
        layerZeroSupported: config.layerZero.deployed || networkName === "localhost",
        axelarSupported: config.axelar.deployed || networkName === "localhost",
        endpoints: {
          layerZero: config.layerZero.endpoint,
          axelarGateway: config.axelar.gateway,
          axelarGasService: config.axelar.gasService
        }
      }
    };
    
    // Update deployment timestamp
    deployment.network.crossChainDeployedAt = new Date().toISOString();
    
    // Save updated deployment
    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));
    console.log("✅ Cross-chain deployment info saved to:", deploymentFile);

    // Step 6: Deploy Mock Contracts for Testing (localhost only)
    if (networkName === "localhost") {
      console.log("\n🧪 Step 6: Deploying Additional Mock Contracts for Testing...");
      
      // Mock contracts are already deployed above, just log summary
      console.log("✅ Mock contracts deployed for comprehensive testing");
    }

    // Print summary
    console.log("\n🎉 CROSS-CHAIN DEPLOYMENT COMPLETE! 🎉\n");
    console.log("📋 Summary:");
    console.log("├── Network:", networkName);
    console.log("├── CrossChainManager:", crossChainManagerAddress);
    
    if (crossChainDeployments.LayerZeroAdapter) {
      console.log("├── LayerZero Adapter:", crossChainDeployments.LayerZeroAdapter);
    }
    if (crossChainDeployments.AxelarAdapter) {
      console.log("├── Axelar Adapter:", crossChainDeployments.AxelarAdapter);
    }
    console.log("└── Supported Protocols:", Object.keys(crossChainDeployments).filter(k => k.includes('Adapter')).length);

    console.log("\n🔗 Cross-Chain Capabilities:");
    console.log("├── LayerZero Support:", config.layerZero.deployed || networkName === "localhost" ? "✅" : "❌");
    console.log("├── Axelar Support:", config.axelar.deployed || networkName === "localhost" ? "✅" : "❌");
    console.log("└── Multi-Chain Trading: Enabled");

    console.log("\n🚀 Next Steps:");
    console.log("1. Configure trusted remotes for each adapter");
    console.log("2. Fund adapters with gas tokens for cross-chain messages");
    console.log("3. Test cross-chain functionality with demo script");
    console.log("4. Update backend to use cross-chain capabilities");

    console.log("\n✨ Crossline is now truly cross-chain! ✨\n");

  } catch (error) {
    console.error("\n❌ Cross-chain deployment failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Cross-chain deployment script failed:", error);
    process.exit(1);
  }); 