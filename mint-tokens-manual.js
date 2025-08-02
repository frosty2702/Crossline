const { ethers } = require('hardhat');

// Token addresses from deployment
const WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Simple ERC20 ABI for minting
const ERC20_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function symbol() external view returns (string)",
  "function decimals() external view returns (uint8)"
];

async function mintTokens() {
  console.log("🪙 Minting test tokens on Sepolia...");
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log("Minting for address:", deployer.address);
  
  // Connect to token contracts
  const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, deployer);
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, deployer);
  
  try {
    // Check current balances first
    console.log("\n💰 Current Balances:");
    const wethBalanceBefore = await weth.balanceOf(deployer.address);
    const usdcBalanceBefore = await usdc.balanceOf(deployer.address);
    console.log("WETH:", ethers.formatEther(wethBalanceBefore));
    console.log("USDC:", ethers.formatEther(usdcBalanceBefore));
    
    // Mint 10 WETH (10 * 10^18)
    console.log("\n🔄 Minting 10 WETH...");
    const wethTx = await weth.mint(deployer.address, ethers.parseEther("10"));
    console.log("WETH transaction sent:", wethTx.hash);
    await wethTx.wait();
    console.log("✅ WETH minted!");
    
    // Mint 10,000 USDC (10000 * 10^18) 
    console.log("\n🔄 Minting 10,000 USDC...");
    const usdcTx = await usdc.mint(deployer.address, ethers.parseEther("10000"));
    console.log("USDC transaction sent:", usdcTx.hash);
    await usdcTx.wait();
    console.log("✅ USDC minted!");
    
    // Check new balances
    console.log("\n💰 New Balances:");
    const wethBalanceAfter = await weth.balanceOf(deployer.address);
    const usdcBalanceAfter = await usdc.balanceOf(deployer.address);
    console.log("WETH:", ethers.formatEther(wethBalanceAfter));
    console.log("USDC:", ethers.formatEther(usdcBalanceAfter));
    
    console.log("\n🎉 Tokens minted successfully!");
    console.log("You can now trade on Crossline DEX!");
    
  } catch (error) {
    console.error("❌ Error minting tokens:", error.message);
    
    if (error.message.includes('caller is not a minter')) {
      console.log("\n💡 The contracts might not have public minting.");
      console.log("Try using the frontend button or check if you're the contract owner.");
    }
  }
}

mintTokens()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 