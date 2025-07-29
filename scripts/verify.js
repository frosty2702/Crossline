const { ethers, network, run } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n🔍 Starting Contract Verification...\n");

  // Load deployment information
  const deploymentFile = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(deploymentFile)) {
    throw new Error(`No deployment found for network: ${network.name}. Run 'npm run deploy:${network.name}' first.`);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  console.log("📋 Loaded deployment for:", deployment.network.name);

  // Skip verification for localhost
  if (network.name === "localhost") {
    console.log("⚠️  Skipping verification for localhost network");
    return;
  }

  try {
    // Verify TokenHandler
    console.log("🔍 Verifying TokenHandler...");
    try {
      await run("verify:verify", {
        address: deployment.contracts.TokenHandler,
        constructorArguments: []
      });
      console.log("✅ TokenHandler verified successfully");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ TokenHandler already verified");
      } else {
        console.error("❌ TokenHandler verification failed:", error.message);
      }
    }

    // Verify CrosslineCore
    console.log("\n🔍 Verifying CrosslineCore...");
    try {
      await run("verify:verify", {
        address: deployment.contracts.CrosslineCore,
        constructorArguments: [
          deployment.configuration.relayer,
          deployment.contracts.TokenHandler,
          deployment.configuration.feeRecipient,
          deployment.configuration.protocolFeeBps
        ]
      });
      console.log("✅ CrosslineCore verified successfully");
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log("✅ CrosslineCore already verified");
      } else {
        console.error("❌ CrosslineCore verification failed:", error.message);
      }
    }

    // Verify Mock Tokens (if localhost deployment was used)
    if (deployment.contracts.MockWETH) {
      console.log("\n🔍 Verifying Mock Tokens...");
      
      try {
        await run("verify:verify", {
          address: deployment.contracts.MockWETH,
          constructorArguments: ["Wrapped Ethereum", "WETH", 18]
        });
        console.log("✅ Mock WETH verified successfully");
      } catch (error) {
        console.log("⚠️  Mock WETH verification skipped:", error.message);
      }

      try {
        await run("verify:verify", {
          address: deployment.contracts.MockUSDC,
          constructorArguments: ["USD Coin", "USDC", 6]
        });
        console.log("✅ Mock USDC verified successfully");
      } catch (error) {
        console.log("⚠️  Mock USDC verification skipped:", error.message);
      }

      try {
        await run("verify:verify", {
          address: deployment.contracts.MockWBTC,
          constructorArguments: ["Wrapped Bitcoin", "WBTC", 8]
        });
        console.log("✅ Mock WBTC verified successfully");
      } catch (error) {
        console.log("⚠️  Mock WBTC verification skipped:", error.message);
      }
    }

    console.log("\n🎉 Verification Complete! 🎉");
    console.log("\n📍 Verified Contracts:");
    console.log("├── TokenHandler:", deployment.contracts.TokenHandler);
    console.log("└── CrosslineCore:", deployment.contracts.CrosslineCore);

    // Print block explorer links
    const explorerUrls = {
      sepolia: "https://sepolia.etherscan.io/address/",
      polygon: "https://polygonscan.com/address/",
      arbitrum: "https://arbiscan.io/address/"
    };

    const explorerUrl = explorerUrls[network.name];
    if (explorerUrl) {
      console.log("\n🔗 View on Block Explorer:");
      console.log("├── TokenHandler:", explorerUrl + deployment.contracts.TokenHandler);
      console.log("└── CrosslineCore:", explorerUrl + deployment.contracts.CrosslineCore);
    }

  } catch (error) {
    console.error("\n❌ Verification failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification script failed:", error);
    process.exit(1);
  }); 