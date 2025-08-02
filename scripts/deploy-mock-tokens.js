const { ethers } = require('hardhat');

async function main() {
  console.log('🪙 Deploying Mock Tokens for Testing...');
  
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  
  // Deploy Mock WETH
  console.log('\n📦 Deploying Mock WETH...');
  const MockWETH = await ethers.getContractFactory('MockERC20');
  const weth = await MockWETH.deploy('Wrapped Ether', 'WETH', 18);
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();
  console.log('✅ Mock WETH deployed to:', wethAddress);
  
  // Deploy Mock USDC
  console.log('\n📦 Deploying Mock USDC...');
  const MockUSDC = await ethers.getContractFactory('MockERC20');
  const usdc = await MockUSDC.deploy('USD Coin', 'USDC', 18);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log('✅ Mock USDC deployed to:', usdcAddress);
  
  // Mint initial tokens to deployer
  console.log('\n🪙 Minting initial tokens...');
  await weth.mint(deployer.address, ethers.parseEther('100'));
  await usdc.mint(deployer.address, ethers.parseEther('100000'));
  console.log('✅ Minted 100 WETH and 100,000 USDC to deployer');
  
  // Update deployment file
  const deploymentInfo = {
    network: {
      name: 'sepolia',
      chainId: 11155111,
      deployedAt: new Date().toISOString()
    },
    mockTokens: {
      WETH: wethAddress,
      USDC: usdcAddress
    },
    deployer: {
      address: deployer.address
    }
  };
  
  const fs = require('fs');
  const path = require('path');
  
  // Read existing deployment file
  const deploymentPath = path.join(__dirname, '../deployments/sepolia.json');
  let existingDeployment = {};
  if (fs.existsSync(deploymentPath)) {
    existingDeployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  }
  
  // Merge with mock tokens
  const updatedDeployment = {
    ...existingDeployment,
    mockTokens: deploymentInfo.mockTokens
  };
  
  fs.writeFileSync(deploymentPath, JSON.stringify(updatedDeployment, null, 2));
  console.log('✅ Updated deployment file with mock token addresses');
  
  console.log('\n🎉 Mock Tokens Deployment Complete!');
  console.log('====================================');
  console.log('Mock WETH:', wethAddress);
  console.log('Mock USDC:', usdcAddress);
  console.log('\n💡 Update your frontend to use these addresses for minting!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 