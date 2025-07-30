const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Network configurations
const NETWORK_CONFIG = {
  localhost: {
    name: "Localhost",
    chainId: 31337,
    confirmations: 1,
    protocolFeeBps: 30, // 0.3%
    tokens: {
      WETH: "0x0000000000000000000000000000000000000000", // Will be deployed
      USDC: "0x0000000000000000000000000000000000000000", // Will be deployed
      WBTC: "0x0000000000000000000000000000000000000000"  // Will be deployed
    }
  },
  sepolia: {
    name: "Sepolia Testnet",
    chainId: 11155111,
    confirmations: 2,
    protocolFeeBps: 30, // 0.3%
    tokens: {
      WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", // Sepolia WETH
      USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia USDC (test)
      WBTC: "0x29f2D40B0605204364af54EC677bD022dA425d03"  // Sepolia WBTC (test)
    }
  },
  polygon: {
    name: "Polygon Mainnet",
    chainId: 137,
    confirmations: 3,
    protocolFeeBps: 30, // 0.3%
    tokens: {
      WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // Polygon WETH
      USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // Polygon USDC
      WBTC: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6"  // Polygon WBTC
    }
  },
  arbitrum: {
    name: "Arbitrum One",
    chainId: 42161,
    confirmations: 3,
    protocolFeeBps: 30, // 0.3%
    tokens: {
      WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // Arbitrum WETH
      USDC: "0xA0b86991c431C0c02E82F3b1fF3C3AAEB1b3bb5Fd", // Arbitrum USDC
      WBTC: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f"  // Arbitrum WBTC
    }
  }
};

async function main() {
  console.log("\n🚀 Starting Crossline Deployment...\n");

  const networkName = network.name;
  const config = NETWORK_CONFIG[networkName];
  
  if (!config) {
    throw new Error(`Unsupported network: ${networkName}`);
  }
  
  console.log(`📍 Deploying to: ${config.name} (Chain ID: ${config.chainId})`);
  console.log(`⚙️  Confirmations required: ${config.confirmations}`);
  console.log(`💰 Protocol fee: ${config.protocolFeeBps} basis points (${config.protocolFeeBps/100}%)\n`);

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const deployerBalance = await ethers.provider.getBalance(deployerAddress);
  
  console.log("👤 Deployer account:", deployerAddress);
  console.log("💰 Deployer balance:", ethers.formatEther(deployerBalance), "ETH\n");

  const feeRecipient = deployerAddress;
  const deployments = {};

  try {
    console.log("📦 Step 1: Deploying TokenHandler...");
    const TokenHandler = await ethers.getContractFactory("TokenHandler");
    const tokenHandler = await TokenHandler.deploy();
    await tokenHandler.waitForDeployment();
    const tokenHandlerAddress = await tokenHandler.getAddress();
    
    console.log("✅ TokenHandler deployed to:", tokenHandlerAddress);
    deployments.TokenHandler = tokenHandlerAddress;

    console.log(`⏳ Waiting for ${config.confirmations} confirmations...`);
    await tokenHandler.deploymentTransaction().wait(config.confirmations);

    console.log("\n📦 Step 2: Deploying CrosslineCore...");
    const CrosslineCore = await ethers.getContractFactory("CrosslineCore");
    const crosslineCore = await CrosslineCore.deploy(
      deployerAddress, // relayer (deployer initially)
      tokenHandlerAddress,
      feeRecipient,
      config.protocolFeeBps
    );
    await crosslineCore.waitForDeployment();
    const crosslineCoreAddress = await crosslineCore.getAddress();
    
    console.log("✅ CrosslineCore deployed to:", crosslineCoreAddress);
    deployments.CrosslineCore = crosslineCoreAddress;

    console.log(`⏳ Waiting for ${config.confirmations} confirmations...`);
    await crosslineCore.deploymentTransaction().wait(config.confirmations);

    console.log("\n📦 Step 3: Deploying CrossChainManager...");
    const CrossChainManager = await ethers.getContractFactory("CrossChainManager");
    const crossChainManager = await CrossChainManager.deploy(crosslineCoreAddress);
    await crossChainManager.waitForDeployment();
    const crossChainManagerAddress = await crossChainManager.getAddress();
    
    console.log("✅ CrossChainManager deployed to:", crossChainManagerAddress);
    deployments.CrossChainManager = crossChainManagerAddress;

    console.log(`⏳ Waiting for ${config.confirmations} confirmations...`);
    await crossChainManager.deploymentTransaction().wait(config.confirmations);

    console.log("\n🔗 Step 4: Linking CrosslineCore with CrossChainManager...");
    const setCrossChainManagerTx = await crosslineCore.setCrossChainManager(crossChainManagerAddress);
    await setCrossChainManagerTx.wait();
    console.log("✅ CrossChainManager linked to CrosslineCore");

    if (networkName === "localhost") {
      console.log("\n📦 Step 5: Deploying Mock Tokens for Testing...");
      
      const MockERC20 = await ethers.getContractFactory("MockERC20");
      
      const mockWETH = await MockERC20.deploy("Wrapped Ethereum", "WETH", 18);
      await mockWETH.waitForDeployment();
      const mockWETHAddress = await mockWETH.getAddress();
      console.log("✅ Mock WETH deployed to:", mockWETHAddress);
      deployments.MockWETH = mockWETHAddress;
      config.tokens.WETH = mockWETHAddress;

      const mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
      await mockUSDC.waitForDeployment();
      const mockUSDCAddress = await mockUSDC.getAddress();
      console.log("✅ Mock USDC deployed to:", mockUSDCAddress);
      deployments.MockUSDC = mockUSDCAddress;
      config.tokens.USDC = mockUSDCAddress;

      const mockWBTC = await MockERC20.deploy("Wrapped Bitcoin", "WBTC", 8);
      await mockWBTC.waitForDeployment();
      const mockWBTCAddress = await mockWBTC.getAddress();
      console.log("✅ Mock WBTC deployed to:", mockWBTCAddress);
      deployments.MockWBTC = mockWBTCAddress;
      config.tokens.WBTC = mockWBTCAddress;

      console.log("\n💸 Minting initial tokens for testing...");
      await mockWETH.mint(deployerAddress, ethers.parseEther("1000"));
      await mockUSDC.mint(deployerAddress, ethers.parseUnits("100000", 6));
      await mockWBTC.mint(deployerAddress, ethers.parseUnits("10", 8));
      console.log("✅ Minted test tokens to deployer");
    }

    console.log("\n⚙️  Step 6: Configuring TokenHandler with supported tokens...");
    
    const tokenAddresses = Object.values(config.tokens).filter(addr => addr !== "0x0000000000000000000000000000000000000000");
    
    for (const tokenAddress of tokenAddresses) {
      try {
        const tx = await tokenHandler.addSupportedToken(tokenAddress);
        await tx.wait();
        console.log(`✅ Added supported token: ${tokenAddress}`);
      } catch (error) {
        console.log(`⚠️  Token ${tokenAddress} might already be supported or invalid`);
      }
    }

    const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    try {
      const tx = await tokenHandler.addSupportedToken(NATIVE_TOKEN);
      await tx.wait();
      console.log("✅ Added native ETH support");
      config.tokens.ETH = NATIVE_TOKEN;
    } catch (error) {
      console.log("⚠️  Native ETH might already be supported");
    }

    console.log("\n🔍 Step 7: Verifying Deployment...");
    
    const tokenHandlerOwner = await tokenHandler.owner();
    console.log("✅ TokenHandler owner:", tokenHandlerOwner);
    
    const coreOwner = await crosslineCore.owner();
    const coreRelayer = await crosslineCore.relayer();
    const coreTokenHandler = await crosslineCore.tokenHandler();
    const coreFeeRecipient = await crosslineCore.feeRecipient();
    const coreProtocolFee = await crosslineCore.protocolFeeBps();
    const corePaused = await crosslineCore.paused();
    const coreCrossChainManager = await crosslineCore.getCrossChainManager();
    
    console.log("✅ CrosslineCore owner:", coreOwner);
    console.log("✅ CrosslineCore relayer:", coreRelayer);
    console.log("✅ CrosslineCore tokenHandler:", coreTokenHandler);
    console.log("✅ CrosslineCore feeRecipient:", coreFeeRecipient);
    console.log("✅ CrosslineCore protocolFee:", coreProtocolFee.toString(), "bps");
    console.log("✅ CrosslineCore paused:", corePaused);
    console.log("✅ CrosslineCore crossChainManager:", coreCrossChainManager);

    const crossChainManagerOwner = await crossChainManager.owner();
    const crossChainManagerCore = await crossChainManager.crosslineCore();
    console.log("✅ CrossChainManager owner:", crossChainManagerOwner);
    console.log("✅ CrossChainManager crosslineCore:", crossChainManagerCore);

    console.log("\n💾 Step 8: Saving Deployment Information...");
    
    const deploymentInfo = {
      network: {
        name: networkName,
        chainId: config.chainId,
        deployedAt: new Date().toISOString()
      },
      contracts: deployments,
      tokens: config.tokens,
      configuration: {
        protocolFeeBps: config.protocolFeeBps,
        feeRecipient,
        relayer: deployerAddress,
        crossChainEnabled: true
      },
      deployer: {
        address: deployerAddress,
        balance: ethers.formatEther(deployerBalance)
      }
    };

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentsDir, `${networkName}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("✅ Deployment info saved to:", deploymentFile);

    console.log("\n🎉 DEPLOYMENT COMPLETE! 🎉\n");
    console.log("📋 Summary:");
    console.log("├── Network:", config.name);
    console.log("├── TokenHandler:", tokenHandlerAddress);
    console.log("├── CrosslineCore:", crosslineCoreAddress);
    console.log("├── CrossChainManager:", crossChainManagerAddress);
    console.log("├── Protocol Fee:", `${config.protocolFeeBps} bps (${config.protocolFeeBps/100}%)`);
    console.log("├── Fee Recipient:", feeRecipient);
    console.log("├── Cross-Chain Enabled:", "✅");
    console.log("└── Supported Tokens:", Object.keys(config.tokens).length);

    console.log("\n🔗 Next Steps:");
    console.log("1. Run 'npm run deploy:crosschain' to deploy cross-chain adapters");
    console.log("2. Run 'npm run demo' to test the deployment");
    console.log("3. Update backend configuration with contract addresses");
    console.log("4. Configure relayer permissions if needed");
    
    if (networkName !== "localhost") {
      console.log("5. Verify contracts on block explorer");
      console.log("6. Transfer ownership if deployer is not the final owner");
    }

    console.log("\n✨ Core contracts ready! Deploy cross-chain adapters next! ✨\n");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment script failed:", error);
    process.exit(1);
  }); 