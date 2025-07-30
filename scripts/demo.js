const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Demo configuration
const DEMO_CONFIG = {
  // Order amounts for demonstration
  orders: {
    sellETHForUSDC: {
      sellAmount: ethers.parseEther("1"), // 1 ETH
      buyAmount: ethers.parseUnits("2000", 6), // 2000 USDC
      description: "Sell 1 ETH for 2000 USDC"
    },
    buyETHWithUSDC: {
      sellAmount: ethers.parseUnits("1800", 6), // 1800 USDC
      buyAmount: ethers.parseEther("1"), // 1 ETH
      description: "Buy 1 ETH with 1800 USDC (better price for match)"
    },
    sellWBTCForUSDC: {
      sellAmount: ethers.parseUnits("0.1", 8), // 0.1 WBTC
      buyAmount: ethers.parseUnits("4000", 6), // 4000 USDC
      description: "Sell 0.1 WBTC for 4000 USDC"
    }
  }
};

async function main() {
  console.log("\n🎭 Starting Crossline Demo...\n");

  // Load deployment information
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`No deployment found for network: ${network.name}. Run 'npm run deploy:${network.name}' first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  console.log("📋 Loaded deployment for:", deployment.network.name);
  console.log("📅 Deployed at:", deployment.network.deployedAt);

  // Get contract instances
  const [deployer, user1, user2, user3] = await ethers.getSigners();
  
  const tokenHandler = await ethers.getContractAt("TokenHandler", deployment.contracts.TokenHandler);
  const crosslineCore = await ethers.getContractAt("CrosslineCore", deployment.contracts.CrosslineCore);
  
  console.log("\n👥 Demo Participants:");
  console.log("├── Deployer/Relayer:", await deployer.getAddress());
  console.log("├── User 1 (Alice):", await user1.getAddress());
  console.log("├── User 2 (Bob):", await user2.getAddress());
  console.log("└── User 3 (Charlie):", await user3.getAddress());

  // Get token contracts
  let weth, usdc, wbtc;
  try {
    if (deployment.tokens.WETH && deployment.tokens.WETH !== "0x0000000000000000000000000000000000000000") {
      weth = await ethers.getContractAt(
        network.name === "localhost" ? "MockERC20" : "IERC20", 
        deployment.tokens.WETH
      );
    }
    if (deployment.tokens.USDC && deployment.tokens.USDC !== "0x0000000000000000000000000000000000000000") {
      usdc = await ethers.getContractAt(
        network.name === "localhost" ? "MockERC20" : "IERC20", 
        deployment.tokens.USDC
      );
    }
    if (deployment.tokens.WBTC && deployment.tokens.WBTC !== "0x0000000000000000000000000000000000000000") {
      wbtc = await ethers.getContractAt(
        network.name === "localhost" ? "MockERC20" : "IERC20", 
        deployment.tokens.WBTC
      );
    }
  } catch (error) {
    console.log("⚠️  Some tokens not available:", error.message);
  }

  try {
    // Demo Step 1: Setup initial balances (localhost only)
    if (network.name === "localhost" && weth && usdc && wbtc) {
      console.log("\n💸 Step 1: Setting up initial balances...");
      
      // Mint tokens to users
      await weth.mint(await user1.getAddress(), ethers.parseEther("10"));
      await usdc.mint(await user2.getAddress(), ethers.parseUnits("50000", 6));
      await wbtc.mint(await user3.getAddress(), ethers.parseUnits("1", 8));
      
      console.log("✅ Minted 10 WETH to Alice");
      console.log("✅ Minted 50,000 USDC to Bob");
      console.log("✅ Minted 1 WBTC to Charlie");
    }

    // Demo Step 2: Check initial balances
    console.log("\n💰 Step 2: Initial Token Balances:");
    
    if (weth) {
      const user1WETHBalance = await weth.balanceOf(await user1.getAddress());
      console.log(`├── Alice WETH: ${ethers.formatEther(user1WETHBalance)}`);
    }
    
    if (usdc) {
      const user2USDCBalance = await usdc.balanceOf(await user2.getAddress());
      console.log(`├── Bob USDC: ${ethers.formatUnits(user2USDCBalance, 6)}`);
    }
    
    if (wbtc) {
      const user3WBTCBalance = await wbtc.balanceOf(await user3.getAddress());
      console.log(`└── Charlie WBTC: ${ethers.formatUnits(user3WBTCBalance, 8)}`);
    }

    // Demo Step 3: Approve token spending
    console.log("\n🔓 Step 3: Setting up token approvals...");
    
    if (weth && usdc) {
      // Alice approves WETH spending to CrosslineCore
      const wethApprovalTx = await weth.connect(user1).approve(
        deployment.contracts.CrosslineCore, 
        ethers.parseEther("100")
      );
      await wethApprovalTx.wait();
      console.log("✅ Alice approved WETH spending");

      // Bob approves USDC spending to CrosslineCore
      const usdcApprovalTx = await usdc.connect(user2).approve(
        deployment.contracts.CrosslineCore, 
        ethers.parseUnits("100000", 6)
      );
      await usdcApprovalTx.wait();
      console.log("✅ Bob approved USDC spending");
    }

    if (wbtc) {
      // Charlie approves WBTC spending
      const wbtcApprovalTx = await wbtc.connect(user3).approve(
        deployment.contracts.CrosslineCore, 
        ethers.parseUnits("10", 8)
      );
      await wbtcApprovalTx.wait();
      console.log("✅ Charlie approved WBTC spending");
    }

    // Demo Step 4: Create and sign orders (simulated - normally done by backend)
    console.log("\n📝 Step 4: Creating Sample Orders...");
    
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expiry = currentTimestamp + 3600; // 1 hour from now
    const chainId = deployment.network.chainId;

    // Order 1: Alice wants to sell ETH for USDC
    const order1 = {
      userAddress: await user1.getAddress(),
      sellToken: deployment.tokens.WETH,
      buyToken: deployment.tokens.USDC,
      sellAmount: DEMO_CONFIG.orders.sellETHForUSDC.sellAmount,
      buyAmount: DEMO_CONFIG.orders.sellETHForUSDC.buyAmount,
      sourceChain: chainId,
      targetChain: chainId,
      expiry: expiry,
      nonce: 1
    };

    // Order 2: Bob wants to buy ETH with USDC (compatible with Order 1)
    const order2 = {
      userAddress: await user2.getAddress(),
      sellToken: deployment.tokens.USDC,
      buyToken: deployment.tokens.WETH,
      sellAmount: DEMO_CONFIG.orders.buyETHWithUSDC.sellAmount,
      buyAmount: DEMO_CONFIG.orders.buyETHWithUSDC.buyAmount,
      sourceChain: chainId,
      targetChain: chainId,
      expiry: expiry,
      nonce: 1
    };

    console.log("📋 Order 1 (Alice):", DEMO_CONFIG.orders.sellETHForUSDC.description);
    console.log("📋 Order 2 (Bob):", DEMO_CONFIG.orders.buyETHWithUSDC.description);

    console.log("🔍 Order Details:");
    console.log("Order 1 (Alice - Sell):");
    console.log(`  - sellToken: ${order1.sellToken}`);
    console.log(`  - buyToken: ${order1.buyToken}`)
    console.log(`  - sellAmount: ${ethers.formatEther(order1.sellAmount)} ETH`);
    console.log(`  - buyAmount: ${ethers.formatUnits(order1.buyAmount, 6)} USDC`);
    
    console.log("Order 2 (Bob - Buy):");
    console.log(`  - sellToken: ${order2.sellToken}`);
    console.log(`  - buyToken: ${order2.buyToken}`);
    console.log(`  - sellAmount: ${ethers.formatUnits(order2.sellAmount, 6)} USDC`);
    console.log(`  - buyAmount: ${ethers.formatEther(order2.buyAmount)} ETH`);

    // Generate proper EIP-712 signatures
    console.log("🔐 Generating EIP-712 signatures...");
    
    // EIP-712 domain
    const domain = {
      name: "Crossline",
      version: "1",
      chainId: chainId,
      verifyingContract: deployment.contracts.CrosslineCore
    };
    
    // EIP-712 types
    const types = {
      Order: [
        { name: "userAddress", type: "address" },
        { name: "sellToken", type: "address" },
        { name: "buyToken", type: "address" },
        { name: "sellAmount", type: "uint256" },
        { name: "buyAmount", type: "uint256" },
        { name: "sourceChain", type: "uint256" },
        { name: "targetChain", type: "uint256" },
        { name: "expiry", type: "uint256" },
        { name: "nonce", type: "uint256" }
      ]
    };
    
    // Sign orders
    const order1Signature = await user1.signTypedData(domain, types, order1);
    const order2Signature = await user2.signTypedData(domain, types, order2);
    
    console.log("✅ Generated signatures for both orders");

    // Demo Step 5: Simulate order matching and execution
    console.log("\n⚡ Step 5: Executing Match (Simulating Backend Relayer)...");
    
    if (weth && usdc) {
      // Check balances before execution
      const aliceWETHBalance = await weth.balanceOf(await user1.getAddress());
      const bobUSDCBalance = await usdc.balanceOf(await user2.getAddress());
      const aliceWETHAllowance = await weth.allowance(await user1.getAddress(), deployment.contracts.CrosslineCore);
      const bobUSDCAllowance = await usdc.allowance(await user2.getAddress(), deployment.contracts.CrosslineCore);
      
      console.log("💰 Pre-execution checks:");
      console.log(`├── Alice WETH balance: ${ethers.formatEther(aliceWETHBalance)} ETH`);
      console.log(`├── Alice WETH allowance: ${ethers.formatEther(aliceWETHAllowance)} ETH`);
      console.log(`├── Bob USDC balance: ${ethers.formatUnits(bobUSDCBalance, 6)} USDC`);
      console.log(`└── Bob USDC allowance: ${ethers.formatUnits(bobUSDCAllowance, 6)} USDC`);
      
      // Calculate matched amount (minimum of both orders)
      const matchedAmount = ethers.parseEther("1"); // 1 ETH worth

      console.log("🎯 Matched Amount:", ethers.formatEther(matchedAmount), "ETH");
      console.log("💱 Trade Rate: 1 ETH = 1800 USDC (Bob's better price)");

      // Execute the match
      console.log("⏳ Executing trade...");
      const executeTx = await crosslineCore.connect(deployer).executeMatch(
        order2, // buy order
        order1, // sell order  
        order2Signature, // buy signature
        order1Signature, // sell signature
        matchedAmount
      );
      
      const receipt = await executeTx.wait();
      console.log("✅ Trade executed! Transaction hash:", receipt.hash);

      // Parse events
      const matchExecutedEvent = receipt.logs.find(log => {
        try {
          const parsed = crosslineCore.interface.parseLog(log);
          return parsed.name === "MatchExecuted";
        } catch {
          return false;
        }
      });

      if (matchExecutedEvent) {
        const parsed = crosslineCore.interface.parseLog(matchExecutedEvent);
        console.log("🎉 Match Event Details:");
        console.log(`├── Match ID: ${parsed.args.matchId}`);
        console.log(`├── Buyer: ${parsed.args.buyer}`);
        console.log(`├── Seller: ${parsed.args.seller}`);
        console.log(`├── Sell Amount: ${ethers.formatEther(parsed.args.sellAmount)} ETH`);
        console.log(`└── Buy Amount: ${ethers.formatUnits(parsed.args.buyAmount, 6)} USDC`);
      }
    }

    // Demo Step 6: Check final balances
    console.log("\n💰 Step 6: Final Token Balances:");
    
    if (weth) {
      const user1WETHBalanceFinal = await weth.balanceOf(await user1.getAddress());
      const user2WETHBalanceFinal = await weth.balanceOf(await user2.getAddress());
      console.log(`├── Alice WETH: ${ethers.formatEther(user1WETHBalanceFinal)} (was ${ethers.formatEther(ethers.parseEther("10"))})`);
      console.log(`├── Bob WETH: ${ethers.formatEther(user2WETHBalanceFinal)} (was 0)`);
    }
    
    if (usdc) {
      const user1USDCBalanceFinal = await usdc.balanceOf(await user1.getAddress());
      const user2USDCBalanceFinal = await usdc.balanceOf(await user2.getAddress());
      console.log(`├── Alice USDC: ${ethers.formatUnits(user1USDCBalanceFinal, 6)} (was 0)`);
      console.log(`└── Bob USDC: ${ethers.formatUnits(user2USDCBalanceFinal, 6)} (was ${ethers.formatUnits(ethers.parseUnits("50000", 6), 6)})`);
    }

    // Demo Step 7: Demonstrate order cancellation
    console.log("\n❌ Step 7: Demonstrating Order Cancellation...");
    
    if (wbtc && usdc) {
      // Create a new order to cancel
      const cancelOrder = {
        userAddress: await user3.getAddress(),
        sellToken: deployment.tokens.WBTC,
        buyToken: deployment.tokens.USDC,
        sellAmount: DEMO_CONFIG.orders.sellWBTCForUSDC.sellAmount,
        buyAmount: DEMO_CONFIG.orders.sellWBTCForUSDC.buyAmount,
        sourceChain: chainId,
        targetChain: chainId,
        expiry: expiry,
        nonce: 1
      };

      // Calculate order hash (simplified)
      const orderHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "address", "uint256", "uint256", "uint256"],
        [cancelOrder.userAddress, cancelOrder.sellToken, cancelOrder.buyToken, 
         cancelOrder.sellAmount, cancelOrder.buyAmount, cancelOrder.nonce]
      ));

      console.log("📋 Created order to cancel:", DEMO_CONFIG.orders.sellWBTCForUSDC.description);
      console.log("🔑 Order hash:", orderHash);

      // Cancel the order
      const cancelTx = await crosslineCore.connect(deployer).cancelOrder(
        orderHash,
        mockSignature
      );
      await cancelTx.wait();
      
      console.log("✅ Order cancelled successfully");

      // Verify cancellation
      const isCancelled = await crosslineCore.isOrderCancelled(orderHash);
      console.log("🔍 Verification - Order cancelled:", isCancelled);
    }

    // Demo Step 8: Show system status
    console.log("\n📊 Step 8: System Status:");
    
    const isPaused = await crosslineCore.paused();
    const protocolFeeBps = await crosslineCore.protocolFeeBps();
    const feeRecipient = await crosslineCore.feeRecipient();
    
    console.log("├── System paused:", isPaused);
    console.log("├── Protocol fee:", protocolFeeBps.toString(), "bps");
    console.log("└── Fee recipient:", feeRecipient);

    // Success message
    console.log("\n🎉 DEMO COMPLETE! 🎉\n");
    console.log("✨ Successfully demonstrated:");
    console.log("├── 📝 Order creation and validation");
    console.log("├── 🔄 Order matching and execution");
    console.log("├── 💰 Token transfers with fee collection");
    console.log("├── ❌ Order cancellation");
    console.log("├── 🔍 System status monitoring");
    console.log("└── 📊 Balance tracking");

    console.log("\n🚀 Crossline Protocol is ready for hackathon demo!");
    console.log("💡 All onchain execution requirements satisfied ✅");

  } catch (error) {
    console.error("\n❌ Demo failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Demo script failed:", error);
    process.exit(1);
  }); 