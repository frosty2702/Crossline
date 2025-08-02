const { ethers } = require('hardhat');

// New mock token addresses
const WETH_ADDRESS = "0xA895E03B50672Bb7e23e33875D9d3223A04074BF";
const USDC_ADDRESS = "0x54EcCfc920a98f97cb2a3b375e6e4cd119e705bC";

const ERC20_ABI = [
  "function mint(address to, uint256 amount) external",
  "function balanceOf(address account) external view returns (uint256)",
  "function symbol() external view returns (string)"
];

async function testTokens() {
  console.log("🧪 Testing New Mock Tokens...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Testing with address:", deployer.address);
  
  const weth = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, deployer);
  const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, deployer);
  
  try {
    // Check current balances
    console.log("\n💰 Current Balances:");
    const wethBalance = await weth.balanceOf(deployer.address);
    const usdcBalance = await usdc.balanceOf(deployer.address);
    console.log("WETH:", ethers.formatEther(wethBalance));
    console.log("USDC:", ethers.formatEther(usdcBalance));
    
    // Test minting 5 more WETH
    console.log("\n🪙 Minting 5 more WETH...");
    const wethTx = await weth.mint(deployer.address, ethers.parseEther("5"));
    await wethTx.wait();
    console.log("✅ WETH minted!");
    
    // Test minting 1000 more USDC
    console.log("\n🪙 Minting 1000 more USDC...");
    const usdcTx = await usdc.mint(deployer.address, ethers.parseEther("1000"));
    await usdcTx.wait();
    console.log("✅ USDC minted!");
    
    // Check final balances
    console.log("\n💰 Final Balances:");
    const finalWethBalance = await weth.balanceOf(deployer.address);
    const finalUsdcBalance = await usdc.balanceOf(deployer.address);
    console.log("WETH:", ethers.formatEther(finalWethBalance));
    console.log("USDC:", ethers.formatEther(finalUsdcBalance));
    
    console.log("\n🎉 Mock tokens work perfectly!");
    console.log("✅ Ready for frontend minting!");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testTokens()
  .then(() => process.exit(0))
  .catch(console.error); 