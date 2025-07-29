const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrosslineCore Contract", function () {
  let crosslineCore, tokenHandler, mockWETH, mockUSDC;
  let owner, relayer, user1, user2, feeRecipient;
  let mockSignature;

  beforeEach(async function () {
    [owner, relayer, user1, user2, feeRecipient] = await ethers.getSigners();
    
    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockWETH = await MockERC20.deploy("Wrapped Ethereum", "WETH", 18);
    await mockWETH.waitForDeployment();
    
    mockUSDC = await MockERC20.deploy("USD Coin", "USDC", 6);
    await mockUSDC.waitForDeployment();
    
    // Deploy TokenHandler
    const TokenHandler = await ethers.getContractFactory("TokenHandler");
    tokenHandler = await TokenHandler.deploy();
    await tokenHandler.waitForDeployment();
    
    // Add tokens to TokenHandler
    await tokenHandler.addSupportedToken(await mockWETH.getAddress());
    await tokenHandler.addSupportedToken(await mockUSDC.getAddress());
    
    // Deploy CrosslineCore
    const CrosslineCore = await ethers.getContractFactory("CrosslineCore");
    crosslineCore = await CrosslineCore.deploy(
      await relayer.getAddress(),
      await tokenHandler.getAddress(),
      await feeRecipient.getAddress(),
      30 // 0.3% protocol fee
    );
    await crosslineCore.waitForDeployment();
    
    // Mock signature for testing
    mockSignature = "0x" + "00".repeat(65);
    
    // Mint tokens to users
    await mockWETH.mint(await user1.getAddress(), ethers.parseEther("10"));
    await mockUSDC.mint(await user2.getAddress(), ethers.parseUnits("20000", 6));
    
    // Set up approvals
    await mockWETH.connect(user1).approve(await tokenHandler.getAddress(), ethers.parseEther("10"));
    await mockUSDC.connect(user2).approve(await tokenHandler.getAddress(), ethers.parseUnits("20000", 6));
  });

  describe("Deployment", function () {
    it("should set correct initial parameters", async function () {
      expect(await crosslineCore.owner()).to.equal(await owner.getAddress());
      expect(await crosslineCore.relayer()).to.equal(await relayer.getAddress());
      expect(await crosslineCore.tokenHandler()).to.equal(await tokenHandler.getAddress());
      expect(await crosslineCore.feeRecipient()).to.equal(await feeRecipient.getAddress());
      expect(await crosslineCore.protocolFeeBps()).to.equal(30);
      expect(await crosslineCore.paused()).to.be.false;
    });

    it("should reject deployment with invalid parameters", async function () {
      const CrosslineCore = await ethers.getContractFactory("CrosslineCore");
      
      // Test zero relayer address
      await expect(
        CrosslineCore.deploy(
          ethers.ZeroAddress,
          await tokenHandler.getAddress(),
          await feeRecipient.getAddress(),
          30
        )
      ).to.be.revertedWithCustomError(CrosslineCore, "InvalidAddress");
      
      // Test zero TokenHandler address
      await expect(
        CrosslineCore.deploy(
          await relayer.getAddress(),
          ethers.ZeroAddress,
          await feeRecipient.getAddress(),
          30
        )
      ).to.be.revertedWithCustomError(CrosslineCore, "InvalidAddress");
      
      // Test high protocol fee
      await expect(
        CrosslineCore.deploy(
          await relayer.getAddress(),
          await tokenHandler.getAddress(),
          await feeRecipient.getAddress(),
          600 // 6% - too high
        )
      ).to.be.revertedWith("Protocol fee too high");
    });
  });

  describe("Administrative Functions", function () {
    it("should allow owner to update relayer", async function () {
      const newRelayer = await user1.getAddress();
      
      await expect(crosslineCore.setRelayer(newRelayer))
        .to.emit(crosslineCore, "RelayerUpdated")
        .withArgs(await relayer.getAddress(), newRelayer);
      
      expect(await crosslineCore.relayer()).to.equal(newRelayer);
    });

    it("should prevent non-owner from updating relayer", async function () {
      await expect(
        crosslineCore.connect(user1).setRelayer(await user2.getAddress())
      ).to.be.revertedWithCustomError(crosslineCore, "Unauthorized");
    });

    it("should allow owner to update protocol fee", async function () {
      const newFeeBps = 50;
      const newFeeRecipient = await user1.getAddress();
      
      await expect(crosslineCore.setProtocolFee(newFeeBps, newFeeRecipient))
        .to.emit(crosslineCore, "ProtocolFeeUpdated")
        .withArgs(30, newFeeBps, await feeRecipient.getAddress(), newFeeRecipient);
      
      expect(await crosslineCore.protocolFeeBps()).to.equal(newFeeBps);
      expect(await crosslineCore.feeRecipient()).to.equal(newFeeRecipient);
    });

    it("should reject excessive protocol fees", async function () {
      await expect(
        crosslineCore.setProtocolFee(600, await feeRecipient.getAddress()) // 6%
      ).to.be.revertedWith("Protocol fee too high");
    });

    it("should allow owner to pause and unpause", async function () {
      // Pause
      await expect(crosslineCore.pause())
        .to.emit(crosslineCore, "ContractPausedEvent")
        .withArgs(true);
      expect(await crosslineCore.paused()).to.be.true;
      
      // Unpause
      await expect(crosslineCore.unpause())
        .to.emit(crosslineCore, "ContractPausedEvent")
        .withArgs(false);
      expect(await crosslineCore.paused()).to.be.false;
    });
  });

  describe("Order Execution", function () {
    let buyOrder, sellOrder;

    beforeEach(async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      const expiry = currentTime + 3600; // 1 hour from now

      // Buy order: User2 wants to buy 1 WETH with 1800 USDC
      buyOrder = {
        userAddress: await user2.getAddress(),
        sellToken: await mockUSDC.getAddress(),
        buyToken: await mockWETH.getAddress(),
        sellAmount: ethers.parseUnits("1800", 6), // 1800 USDC
        buyAmount: ethers.parseEther("1"), // 1 WETH
        sourceChain: 31337,
        targetChain: 31337,
        expiry: expiry,
        nonce: 1
      };

      // Sell order: User1 wants to sell 1 WETH for 2000 USDC
      sellOrder = {
        userAddress: await user1.getAddress(),
        sellToken: await mockWETH.getAddress(),
        buyToken: await mockUSDC.getAddress(),
        sellAmount: ethers.parseEther("1"), // 1 WETH
        buyAmount: ethers.parseUnits("2000", 6), // 2000 USDC
        sourceChain: 31337,
        targetChain: 31337,
        expiry: expiry,
        nonce: 1
      };
    });

    it("should execute a valid match successfully", async function () {
      const matchedAmount = ethers.parseEther("1"); // 1 WETH
      
      const user1WETHBefore = await mockWETH.balanceOf(await user1.getAddress());
      const user1USDCBefore = await mockUSDC.balanceOf(await user1.getAddress());
      const user2WETHBefore = await mockWETH.balanceOf(await user2.getAddress());
      const user2USDCBefore = await mockUSDC.balanceOf(await user2.getAddress());
      
      const tx = await crosslineCore.connect(relayer).executeMatch(
        buyOrder,
        sellOrder,
        mockSignature,
        mockSignature,
        matchedAmount
      );
      
      // Check for MatchExecuted event
      await expect(tx).to.emit(crosslineCore, "MatchExecuted");
      
      // Check for NonceUsed events
      await expect(tx).to.emit(crosslineCore, "NonceUsed")
        .withArgs(await user2.getAddress(), 1, ethers.ZeroHash); // We use mock signatures, so order hash will be different
      
      // Verify token transfers occurred
      const user1WETHAfter = await mockWETH.balanceOf(await user1.getAddress());
      const user1USDCAfter = await mockUSDC.balanceOf(await user1.getAddress());
      const user2WETHAfter = await mockWETH.balanceOf(await user2.getAddress());
      const user2USDCAfter = await mockUSDC.balanceOf(await user2.getAddress());
      
      // User1 should have less WETH and more USDC
      expect(user1WETHAfter).to.be.lt(user1WETHBefore);
      expect(user1USDCAfter).to.be.gt(user1USDCBefore);
      
      // User2 should have more WETH and less USDC
      expect(user2WETHAfter).to.be.gt(user2WETHBefore);
      expect(user2USDCAfter).to.be.lt(user2USDCBefore);
    });

    it("should prevent non-relayer from executing matches", async function () {
      const matchedAmount = ethers.parseEther("1");
      
      await expect(
        crosslineCore.connect(user1).executeMatch(
          buyOrder,
          sellOrder, 
          mockSignature,
          mockSignature,
          matchedAmount
        )
      ).to.be.revertedWithCustomError(crosslineCore, "Unauthorized");
    });

    it("should prevent execution when paused", async function () {
      await crosslineCore.pause();
      
      const matchedAmount = ethers.parseEther("1");
      
      await expect(
        crosslineCore.connect(relayer).executeMatch(
          buyOrder,
          sellOrder,
          mockSignature,
          mockSignature,
          matchedAmount
        )
      ).to.be.revertedWithCustomError(crosslineCore, "ContractPaused");
    });

    it("should prevent double execution of same match", async function () {
      const matchedAmount = ethers.parseEther("1");
      
      // Execute first time
      await crosslineCore.connect(relayer).executeMatch(
        buyOrder,
        sellOrder,
        mockSignature,
        mockSignature,
        matchedAmount
      );
      
      // Try to execute again with same orders (will have same match ID)
      await expect(
        crosslineCore.connect(relayer).executeMatch(
          buyOrder,
          sellOrder,
          mockSignature,
          mockSignature,
          matchedAmount
        )
      ).to.be.revertedWithCustomError(crosslineCore, "NonceAlreadyUsed");
    });

    it("should reject incompatible orders", async function () {
      // Create incompatible order (different token pair)
      const incompatibleOrder = {
        ...buyOrder,
        buyToken: await mockUSDC.getAddress(), // Wrong token
        sellToken: await mockWETH.getAddress()
      };
      
      const matchedAmount = ethers.parseEther("1");
      
      await expect(
        crosslineCore.connect(relayer).executeMatch(
          incompatibleOrder,
          sellOrder,
          mockSignature,
          mockSignature,
          matchedAmount
        )
      ).to.be.revertedWithCustomError(crosslineCore, "OrderMismatch");
    });

    it("should reject orders with mismatched chains", async function () {
      const wrongChainOrder = {
        ...buyOrder,
        sourceChain: 1, // Different chain
        targetChain: 137
      };
      
      const matchedAmount = ethers.parseEther("1");
      
      await expect(
        crosslineCore.connect(relayer).executeMatch(
          wrongChainOrder,
          sellOrder,
          mockSignature,
          mockSignature,
          matchedAmount
        )
      ).to.be.revertedWithCustomError(crosslineCore, "CrossChainMismatch");
    });

    it("should reject expired orders", async function () {
      const expiredOrder = {
        ...buyOrder,
        expiry: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      };
      
      const matchedAmount = ethers.parseEther("1");
      
      await expect(
        crosslineCore.connect(relayer).executeMatch(
          expiredOrder,
          sellOrder,
          mockSignature,
          mockSignature,
          matchedAmount
        )
      ).to.be.revertedWithCustomError(crosslineCore, "InvalidOrder");
    });
  });

  describe("Order Cancellation", function () {
    it("should allow order cancellation", async function () {
      const orderHash = ethers.keccak256(ethers.toUtf8Bytes("test-order-hash"));
      
      await expect(
        crosslineCore.connect(relayer).cancelOrder(orderHash, mockSignature)
      ).to.emit(crosslineCore, "OrderCancelled")
        .withArgs(orderHash, ethers.ZeroAddress, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));
      
      expect(await crosslineCore.isOrderCancelled(orderHash)).to.be.true;
    });

    it("should prevent cancelling already cancelled orders", async function () {
      const orderHash = ethers.keccak256(ethers.toUtf8Bytes("test-order-hash"));
      
      // Cancel first time
      await crosslineCore.connect(relayer).cancelOrder(orderHash, mockSignature);
      
      // Try to cancel again
      await expect(
        crosslineCore.connect(relayer).cancelOrder(orderHash, mockSignature)
      ).to.be.revertedWithCustomError(crosslineCore, "OrderCancelled");
    });

    it("should allow batch order cancellation", async function () {
      const orderHashes = [
        ethers.keccak256(ethers.toUtf8Bytes("order-1")),
        ethers.keccak256(ethers.toUtf8Bytes("order-2")),
        ethers.keccak256(ethers.toUtf8Bytes("order-3"))
      ];
      const signatures = [mockSignature, mockSignature, mockSignature];
      
      await crosslineCore.connect(relayer).batchCancelOrders(orderHashes, signatures);
      
      for (const hash of orderHashes) {
        expect(await crosslineCore.isOrderCancelled(hash)).to.be.true;
      }
    });

    it("should allow nonce range invalidation", async function () {
      const startNonce = 1;
      const endNonce = 5;
      
      await crosslineCore.connect(user1).invalidateNonceRange(startNonce, endNonce);
      
      for (let nonce = startNonce; nonce <= endNonce; nonce++) {
        expect(await crosslineCore.isNonceUsed(await user1.getAddress(), nonce)).to.be.true;
      }
    });

    it("should reject large nonce ranges", async function () {
      await expect(
        crosslineCore.connect(user1).invalidateNonceRange(1, 1500) // Too large
      ).to.be.revertedWith("Range too large");
    });
  });

  describe("Batch Query Functions", function () {
    beforeEach(async function () {
      // Set up some test data
      await crosslineCore.connect(user1).invalidateNonceRange(1, 3);
      
      const orderHashes = [
        ethers.keccak256(ethers.toUtf8Bytes("order-1")),
        ethers.keccak256(ethers.toUtf8Bytes("order-2"))
      ];
      await crosslineCore.connect(relayer).batchCancelOrders(
        orderHashes, 
        [mockSignature, mockSignature]
      );
    });

    it("should batch check nonce statuses", async function () {
      const nonces = [1, 2, 3, 4, 5];
      const statuses = await crosslineCore.getNonceStatuses(await user1.getAddress(), nonces);
      
      expect(statuses.length).to.equal(5);
      expect(statuses[0]).to.be.true; // Used
      expect(statuses[1]).to.be.true; // Used
      expect(statuses[2]).to.be.true; // Used
      expect(statuses[3]).to.be.false; // Not used
      expect(statuses[4]).to.be.false; // Not used
    });

    it("should batch check order cancellation statuses", async function () {
      const orderHashes = [
        ethers.keccak256(ethers.toUtf8Bytes("order-1")),
        ethers.keccak256(ethers.toUtf8Bytes("order-2")),
        ethers.keccak256(ethers.toUtf8Bytes("order-3"))
      ];
      
      const statuses = await crosslineCore.getOrderCancellationStatuses(orderHashes);
      
      expect(statuses.length).to.equal(3);
      expect(statuses[0]).to.be.true; // Cancelled
      expect(statuses[1]).to.be.true; // Cancelled
      expect(statuses[2]).to.be.false; // Not cancelled
    });

    it("should batch validate orders", async function () {
      const currentTime = Math.floor(Date.now() / 1000);
      
      const validOrder = {
        userAddress: await user1.getAddress(),
        sellToken: await mockWETH.getAddress(),
        buyToken: await mockUSDC.getAddress(),
        sellAmount: ethers.parseEther("1"),
        buyAmount: ethers.parseUnits("2000", 6),
        sourceChain: 31337,
        targetChain: 31337,
        expiry: currentTime + 3600,
        nonce: 10 // Not used
      };
      
      const expiredOrder = {
        ...validOrder,
        expiry: currentTime - 3600, // Expired
        nonce: 11
      };
      
      const [results, reasons] = await crosslineCore.batchValidateOrders([validOrder, expiredOrder]);
      
      expect(results.length).to.equal(2);
      expect(results[0]).to.be.true; // Valid
      expect(results[1]).to.be.false; // Invalid (expired)
      expect(reasons[0]).to.equal("");
      expect(reasons[1]).to.not.equal("");
    });
  });

  describe("Emergency Functions", function () {
    it("should allow owner to emergency mark match executed", async function () {
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("emergency-match"));
      
      await crosslineCore.emergencyMarkMatchExecuted(matchId);
      
      expect(await crosslineCore.isMatchExecuted(matchId)).to.be.true;
    });

    it("should allow owner to emergency unmark match executed", async function () {
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("emergency-match"));
      
      // Mark first
      await crosslineCore.emergencyMarkMatchExecuted(matchId);
      expect(await crosslineCore.isMatchExecuted(matchId)).to.be.true;
      
      // Then unmark
      await crosslineCore.emergencyUnmarkMatchExecuted(matchId);
      expect(await crosslineCore.isMatchExecuted(matchId)).to.be.false;
    });

    it("should prevent non-owner from using emergency functions", async function () {
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("emergency-match"));
      
      await expect(
        crosslineCore.connect(user1).emergencyMarkMatchExecuted(matchId)
      ).to.be.revertedWithCustomError(crosslineCore, "Unauthorized");
    });
  });

  describe("View Functions", function () {
    it("should correctly report nonce usage", async function () {
      expect(await crosslineCore.isNonceUsed(await user1.getAddress(), 1)).to.be.false;
      
      await crosslineCore.connect(user1).invalidateNonceRange(1, 1);
      
      expect(await crosslineCore.isNonceUsed(await user1.getAddress(), 1)).to.be.true;
    });

    it("should correctly report order cancellation", async function () {
      const orderHash = ethers.keccak256(ethers.toUtf8Bytes("test-order"));
      
      expect(await crosslineCore.isOrderCancelled(orderHash)).to.be.false;
      
      await crosslineCore.connect(relayer).cancelOrder(orderHash, mockSignature);
      
      expect(await crosslineCore.isOrderCancelled(orderHash)).to.be.true;
    });

    it("should correctly report match execution", async function () {
      const matchId = ethers.keccak256(ethers.toUtf8Bytes("test-match"));
      
      expect(await crosslineCore.isMatchExecuted(matchId)).to.be.false;
      
      await crosslineCore.emergencyMarkMatchExecuted(matchId);
      
      expect(await crosslineCore.isMatchExecuted(matchId)).to.be.true;
    });
  });
}); 