const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrderValidator Library", function () {
  let orderValidator;
  let mockOrder;
  
  beforeEach(async function () {
    // Deploy a test contract that uses OrderValidator
    const OrderValidatorTest = await ethers.getContractFactory("OrderValidatorTest");
    orderValidator = await OrderValidatorTest.deploy();
    await orderValidator.waitForDeployment();
    
    // Create a valid mock order
    const [user] = await ethers.getSigners();
    mockOrder = {
      userAddress: await user.getAddress(),
      sellToken: "0x1234567890123456789012345678901234567890",
      buyToken: "0x0987654321098765432109876543210987654321",
      sellAmount: ethers.parseEther("1"),
      buyAmount: ethers.parseUnits("2000", 6),
      sourceChain: 1,
      targetChain: 137,
      expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      nonce: 1
    };
  });

  describe("validateOrderStructure", function () {
    it("should validate a correct order structure", async function () {
      const [valid, reason] = await orderValidator.testValidateOrderStructure(mockOrder);
      expect(valid).to.be.true;
      expect(reason).to.equal("");
    });

    it("should reject order with zero user address", async function () {
      const invalidOrder = { ...mockOrder, userAddress: ethers.ZeroAddress };
      const [valid, reason] = await orderValidator.testValidateOrderStructure(invalidOrder);
      expect(valid).to.be.false;
      expect(reason).to.include("Invalid user address");
    });

    it("should reject order with zero sell token", async function () {
      const invalidOrder = { ...mockOrder, sellToken: ethers.ZeroAddress };
      const [valid, reason] = await orderValidator.testValidateOrderStructure(invalidOrder);
      expect(valid).to.be.false;
      expect(reason).to.include("Invalid sell token");
    });

    it("should reject order with zero buy token", async function () {
      const invalidOrder = { ...mockOrder, buyToken: ethers.ZeroAddress };
      const [valid, reason] = await orderValidator.testValidateOrderStructure(invalidOrder);
      expect(valid).to.be.false;
      expect(reason).to.include("Invalid buy token");
    });

    it("should reject order with same sell and buy tokens", async function () {
      const invalidOrder = { ...mockOrder, buyToken: mockOrder.sellToken };
      const [valid, reason] = await orderValidator.testValidateOrderStructure(invalidOrder);
      expect(valid).to.be.false;
      expect(reason).to.include("Same sell and buy token");
    });

    it("should reject order with zero sell amount", async function () {
      const invalidOrder = { ...mockOrder, sellAmount: 0 };
      const [valid, reason] = await orderValidator.testValidateOrderStructure(invalidOrder);
      expect(valid).to.be.false;
      expect(reason).to.include("Invalid sell amount");
    });

    it("should reject order with zero buy amount", async function () {
      const invalidOrder = { ...mockOrder, buyAmount: 0 };
      const [valid, reason] = await orderValidator.testValidateOrderStructure(invalidOrder);
      expect(valid).to.be.false;
      expect(reason).to.include("Invalid buy amount");
    });
  });

  describe("isOrderExpired", function () {
    it("should return false for non-expired order", async function () {
      const futureExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const orderWithFutureExpiry = { ...mockOrder, expiry: futureExpiry };
      const expired = await orderValidator.testIsOrderExpired(orderWithFutureExpiry);
      expect(expired).to.be.false;
    });

    it("should return true for expired order", async function () {
      const pastExpiry = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const orderWithPastExpiry = { ...mockOrder, expiry: pastExpiry };
      const expired = await orderValidator.testIsOrderExpired(orderWithPastExpiry);
      expect(expired).to.be.true;
    });

    it("should handle edge case of exactly current timestamp", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const orderWithCurrentExpiry = { ...mockOrder, expiry: currentTime };
      const expired = await orderValidator.testIsOrderExpired(orderWithCurrentExpiry);
      // Should be expired since block.timestamp >= expiry
      expect(expired).to.be.true;
    });
  });

  describe("validateChains", function () {
    it("should validate supported chain combinations", async function () {
      // Ethereum to Polygon
      expect(await orderValidator.testValidateChains(1, 137)).to.be.true;
      
      // Polygon to Arbitrum
      expect(await orderValidator.testValidateChains(137, 42161)).to.be.true;
      
      // Same chain (should be valid)
      expect(await orderValidator.testValidateChains(1, 1)).to.be.true;
    });

    it("should reject unsupported chains", async function () {
      // Unsupported source chain
      expect(await orderValidator.testValidateChains(999, 1)).to.be.false;
      
      // Unsupported target chain
      expect(await orderValidator.testValidateChains(1, 999)).to.be.false;
      
      // Both unsupported
      expect(await orderValidator.testValidateChains(999, 888)).to.be.false;
    });
  });

  describe("isValidOrder", function () {
    it("should validate a complete valid order", async function () {
      const [valid, reason] = await orderValidator.testIsValidOrder(mockOrder);
      expect(valid).to.be.true;
      expect(reason).to.equal("");
    });

    it("should reject order with multiple issues", async function () {
      const invalidOrder = {
        ...mockOrder,
        userAddress: ethers.ZeroAddress,
        sellAmount: 0,
        expiry: Math.floor(Date.now() / 1000) - 3600 // expired
      };
      
      const [valid, reason] = await orderValidator.testIsValidOrder(invalidOrder);
      expect(valid).to.be.false;
      expect(reason).to.not.equal("");
    });
  });

  describe("getOrderPrice", function () {
    it("should calculate correct price ratio", async function () {
      // Order: sell 1 ETH for 2000 USDC
      // Price should be 2000 (buyAmount/sellAmount * 1e18 for precision)
      const order = {
        ...mockOrder,
        sellAmount: ethers.parseEther("1"), // 1 ETH
        buyAmount: ethers.parseUnits("2000", 6) // 2000 USDC
      };
      
      const price = await orderValidator.testGetOrderPrice(order);
      // Price = (2000 * 10^6 * 10^18) / (1 * 10^18) = 2000 * 10^6
      const expectedPrice = BigInt(2000) * BigInt(10**6);
      expect(price).to.equal(expectedPrice);
    });

    it("should handle different decimal combinations", async function () {
      // Order: sell 0.1 WBTC (8 decimals) for 4000 USDC (6 decimals)
      const order = {
        ...mockOrder,
        sellAmount: ethers.parseUnits("0.1", 8), // 0.1 WBTC
        buyAmount: ethers.parseUnits("4000", 6) // 4000 USDC
      };
      
      const price = await orderValidator.testGetOrderPrice(order);
      // Price = (4000 * 10^6 * 10^18) / (0.1 * 10^8) = 4000 * 10^16
      const expectedPrice = BigInt(4000) * BigInt(10**16);
      expect(price).to.equal(expectedPrice);
    });

    it("should handle very small amounts", async function () {
      const order = {
        ...mockOrder,
        sellAmount: 1, // 1 wei
        buyAmount: 2 // 2 wei
      };
      
      const price = await orderValidator.testGetOrderPrice(order);
      // Price = (2 * 10^18) / 1 = 2 * 10^18
      const expectedPrice = BigInt(2) * BigInt(10**18);
      expect(price).to.equal(expectedPrice);
    });
  });

  describe("Gas Usage", function () {
    it("should have reasonable gas costs for validation", async function () {
      const tx = await orderValidator.testIsValidOrder(mockOrder);
      const receipt = await tx.wait();
      
      // Gas usage should be reasonable (less than 100k gas)
      expect(receipt.gasUsed).to.be.lt(100000);
    });
  });
}); 