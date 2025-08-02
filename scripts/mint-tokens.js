const { ethers } = require('hardhat');

// Token addresses from Sepolia deployment
const WETH_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

// Simple ERC20 ABI for minting
const ERC20_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function symbol() external view returns (string)"
];

async function main() {
  console.log("🪙 Minting test tokens on Sepolia...");
  
  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log("Minting for address:", deployer.address);
  
  // Connect to token contracts
  const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, deployer);
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, deployer);
  
  try {
    // Mint 10 WETH (10 * 10^18)
    console.log("🔄 Minting 10 WETH...");
    const wethTx = await weth.mint(deployer.address, ethers.parseEther("10"));
    await wethTx.wait();
    console.log("✅ WETH minted! Tx:", wethTx.hash);
    
    // Mint 10,000 USDC (10000 * 10^18) 
    console.log("🔄 Minting 10,000 USDC...");
    const usdcTx = await usdc.mint(deployer.address, ethers.parseEther("10000"));
    await usdcTx.wait();
    console.log("✅ USDC minted! Tx:", usdcTx.hash);
    
    // Check balances
    const wethBalance = await weth.balanceOf(deployer.address);
    const usdcBalance = await usdc.balanceOf(deployer.address);
    
    console.log("\n💰 New Balances:");
    console.log("WETH:", ethers.formatEther(wethBalance));
    console.log("USDC:", ethers.formatEther(usdcBalance));
    
    console.log("\n🎉 Tokens minted successfully!");
    console.log("You can now trade on Crossline DEX!");
    
  } catch (error) {
    console.error("❌ Error minting tokens:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 