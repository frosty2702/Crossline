const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TokenHandler Contract", function () {
  let tokenHandler;
  let mockERC20;
  let owner, user1, user2, spender;
  const NATIVE_TOKEN = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

  beforeEach(async function () {
    [owner, user1, user2, spender] = await ethers.getSigners();

    // Deploy TokenHandler
    const TokenHandler = await ethers.getContractFactory("TokenHandler");
    tokenHandler = await TokenHandler.deploy();
    await tokenHandler.waitForDeployment();

    // Deploy Mock ERC20 for testing
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    mockERC20 = await MockERC20.deploy("Test Token", "TEST", 18);
    await mockERC20.waitForDeployment();

    // Mint tokens to users
    await mockERC20.mint(await user1.getAddress(), ethers.parseEther("1000"));
    await mockERC20.mint(await user2.getAddress(), ethers.parseEther("1000"));
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await tokenHandler.owner()).to.equal(await owner.getAddress());
    });

    it("should support native token by default", async function () {
      const isSupported = await tokenHandler.isTokenSupported(NATIVE_TOKEN);
      expect(isSupported).to.be.true;
    });
  });

  describe("Token Management", function () {
    it("should allow owner to add supported tokens", async function () {
      const tokenAddress = await mockERC20.getAddress();
      
      await expect(tokenHandler.addSupportedToken(tokenAddress))
        .to.emit(tokenHandler, "TokenAdded")
        .withArgs(tokenAddress);
      
      expect(await tokenHandler.isTokenSupported(tokenAddress)).to.be.true;
    });

    it("should prevent non-owner from adding tokens", async function () {
      const tokenAddress = await mockERC20.getAddress();
      
      await expect(
        tokenHandler.connect(user1).addSupportedToken(tokenAddress)
      ).to.be.revertedWithCustomError(tokenHandler, "Unauthorized");
    });

    it("should allow owner to remove supported tokens", async function () {
      const tokenAddress = await mockERC20.getAddress();
      
      // Add first
      await tokenHandler.addSupportedToken(tokenAddress);
      expect(await tokenHandler.isTokenSupported(tokenAddress)).to.be.true;
      
      // Then remove
      await expect(tokenHandler.removeSupportedToken(tokenAddress))
        .to.emit(tokenHandler, "TokenRemoved")
        .withArgs(tokenAddress);
      
      expect(await tokenHandler.isTokenSupported(tokenAddress)).to.be.false;
    });

    it("should reject zero address tokens", async function () {
      await expect(
        tokenHandler.addSupportedToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(tokenHandler, "InvalidAddress");
    });

    it("should set minimum balances", async function () {
      const tokenAddress = await mockERC20.getAddress();
      await tokenHandler.addSupportedToken(tokenAddress);
      
      const minBalance = ethers.parseEther("1");
      await tokenHandler.setMinimumBalance(tokenAddress, minBalance);
      
      const [supported, actualMinBalance] = await tokenHandler.getTokenInfo(tokenAddress);
      expect(supported).to.be.true;
      expect(actualMinBalance).to.equal(minBalance);
    });
  });

  describe("Balance and Allowance Checks", function () {
    beforeEach(async function () {
      const tokenAddress = await mockERC20.getAddress();
      await tokenHandler.addSupportedToken(tokenAddress);
    });

    it("should check ERC20 balance correctly", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const userAddress = await user1.getAddress();
      const checkAmount = ethers.parseEther("500");
      
      const [sufficient, actualBalance] = await tokenHandler.checkBalance(
        tokenAddress, 
        userAddress, 
        checkAmount
      );
      
      expect(sufficient).to.be.true;
      expect(actualBalance).to.equal(ethers.parseEther("1000"));
    });

    it("should detect insufficient ERC20 balance", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const userAddress = await user1.getAddress();
      const checkAmount = ethers.parseEther("2000"); // More than minted
      
      const [sufficient, actualBalance] = await tokenHandler.checkBalance(
        tokenAddress, 
        userAddress, 
        checkAmount
      );
      
      expect(sufficient).to.be.false;
      expect(actualBalance).to.equal(ethers.parseEther("1000"));
    });

    it("should check ETH balance correctly", async function () {
      const userAddress = await user1.getAddress();
      const checkAmount = ethers.parseEther("1");
      
      const [sufficient, actualBalance] = await tokenHandler.checkBalance(
        NATIVE_TOKEN, 
        userAddress, 
        checkAmount
      );
      
      expect(sufficient).to.be.true;
      expect(actualBalance).to.be.gt(ethers.parseEther("9000")); // Hardhat default
    });

    it("should check ERC20 allowance correctly", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const userAddress = await user1.getAddress();
      const spenderAddress = await spender.getAddress();
      const allowanceAmount = ethers.parseEther("100");
      
      // Set allowance
      await mockERC20.connect(user1).approve(spenderAddress, allowanceAmount);
      
      const [sufficient, actualAllowance] = await tokenHandler.checkAllowance(
        tokenAddress,
        userAddress,
        spenderAddress,
        ethers.parseEther("50")
      );
      
      expect(sufficient).to.be.true;
      expect(actualAllowance).to.equal(allowanceAmount);
    });

    it("should detect insufficient allowance", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const userAddress = await user1.getAddress();
      const spenderAddress = await spender.getAddress();
      
      const [sufficient, actualAllowance] = await tokenHandler.checkAllowance(
        tokenAddress,
        userAddress,
        spenderAddress,
        ethers.parseEther("50")
      );
      
      expect(sufficient).to.be.false;
      expect(actualAllowance).to.equal(0);
    });
  });

  describe("Transfer Validation", function () {
    beforeEach(async function () {
      const tokenAddress = await mockERC20.getAddress();
      await tokenHandler.addSupportedToken(tokenAddress);
      
      // Set up allowances
      await mockERC20.connect(user1).approve(await spender.getAddress(), ethers.parseEther("500"));
    });

    it("should validate successful ERC20 transfer", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const [valid, reason] = await tokenHandler.validateTransfer(
        tokenAddress,
        await user1.getAddress(),
        await user2.getAddress(),
        ethers.parseEther("100"),
        await spender.getAddress()
      );
      
      expect(valid).to.be.true;
      expect(reason).to.equal("");
    });

    it("should reject transfer with insufficient balance", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const [valid, reason] = await tokenHandler.validateTransfer(
        tokenAddress,
        await user1.getAddress(),
        await user2.getAddress(),
        ethers.parseEther("2000"), // More than balance
        await spender.getAddress()
      );
      
      expect(valid).to.be.false;
      expect(reason).to.include("Insufficient balance");
    });

    it("should reject transfer with insufficient allowance", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const [valid, reason] = await tokenHandler.validateTransfer(
        tokenAddress,
        await user1.getAddress(),
        await user2.getAddress(),
        ethers.parseEther("600"), // More than allowance
        await spender.getAddress()
      );
      
      expect(valid).to.be.false;
      expect(reason).to.include("Insufficient allowance");
    });

    it("should reject unsupported tokens", async function () {
      // Use a different token not added to supported list
      const MockERC20_2 = await ethers.getContractFactory("MockERC20");
      const mockERC20_2 = await MockERC20_2.deploy("Test Token 2", "TEST2", 18);
      await mockERC20_2.waitForDeployment();
      
      await expect(
        tokenHandler.validateTransfer(
          await mockERC20_2.getAddress(),
          await user1.getAddress(),
          await user2.getAddress(),
          ethers.parseEther("100"),
          await spender.getAddress()
        )
      ).to.be.revertedWithCustomError(tokenHandler, "UnsupportedToken");
    });
  });

  describe("Batch Operations", function () {
    beforeEach(async function () {
      const tokenAddress = await mockERC20.getAddress();
      await tokenHandler.addSupportedToken(tokenAddress);
    });

    it("should batch validate transfers", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const tokens = [tokenAddress, tokenAddress];
      const froms = [await user1.getAddress(), await user2.getAddress()];
      const tos = [await user2.getAddress(), await user1.getAddress()];
      const amounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      
      // Set up allowances
      await mockERC20.connect(user1).approve(await spender.getAddress(), ethers.parseEther("500"));
      await mockERC20.connect(user2).approve(await spender.getAddress(), ethers.parseEther("500"));
      
      const [results, reasons] = await tokenHandler.batchValidateTransfers(
        tokens,
        froms,
        tos,
        amounts,
        await spender.getAddress()
      );
      
      expect(results.length).to.equal(2);
      expect(results[0]).to.be.true;
      expect(results[1]).to.be.true;
      expect(reasons[0]).to.equal("");
      expect(reasons[1]).to.equal("");
    });

    it("should batch get balances", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const tokens = [tokenAddress, tokenAddress];
      const users = [await user1.getAddress(), await user2.getAddress()];
      
      const balances = await tokenHandler.batchGetBalances(tokens, users);
      
      expect(balances.length).to.equal(2);
      expect(balances[0]).to.equal(ethers.parseEther("1000"));
      expect(balances[1]).to.equal(ethers.parseEther("1000"));
    });

    it("should batch get token info", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const tokens = [tokenAddress, NATIVE_TOKEN];
      
      const [supported, minBalances] = await tokenHandler.batchGetTokenInfo(tokens);
      
      expect(supported.length).to.equal(2);
      expect(minBalances.length).to.equal(2);
      expect(supported[0]).to.be.true; // ERC20 token
      expect(supported[1]).to.be.true; // Native token
    });
  });

  describe("Safe Transfer Functions", function () {
    let matchId;

    beforeEach(async function () {
      const tokenAddress = await mockERC20.getAddress(); 
      await tokenHandler.addSupportedToken(tokenAddress);
      
      // Set up allowances
      await mockERC20.connect(user1).approve(await tokenHandler.getAddress(), ethers.parseEther("500"));
      
      matchId = ethers.keccak256(ethers.toUtf8Bytes("test-match-1"));
    });

    it("should execute safe ERC20 transfer", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const transferAmount = ethers.parseEther("100");
      
      const initialBalanceFrom = await mockERC20.balanceOf(await user1.getAddress());
      const initialBalanceTo = await mockERC20.balanceOf(await user2.getAddress());
      
      await expect(
        tokenHandler.safeTransfer(
          tokenAddress,
          await user1.getAddress(),
          await user2.getAddress(),
          transferAmount,
          matchId
        )
      ).to.emit(tokenHandler, "TokenTransfer")
        .withArgs(tokenAddress, await user1.getAddress(), await user2.getAddress(), transferAmount, matchId);
      
      const finalBalanceFrom = await mockERC20.balanceOf(await user1.getAddress());
      const finalBalanceTo = await mockERC20.balanceOf(await user2.getAddress());
      
      expect(finalBalanceFrom).to.equal(initialBalanceFrom - transferAmount);
      expect(finalBalanceTo).to.equal(initialBalanceTo + transferAmount);
    });

    it("should execute safe transfer with fees", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const transferAmount = ethers.parseEther("100");
      const feeBps = 300; // 3%
      const feeRecipient = await owner.getAddress();
      
      const expectedFee = (transferAmount * BigInt(feeBps)) / BigInt(10000);
      const expectedNetAmount = transferAmount - expectedFee;
      
      const tx = await tokenHandler.safeTransferWithFees(
        tokenAddress,
        await user1.getAddress(),
        await user2.getAddress(), 
        transferAmount,
        feeRecipient,
        feeBps,
        matchId
      );
      
      await expect(tx).to.emit(tokenHandler, "TokenTransfer")
        .withArgs(tokenAddress, await user1.getAddress(), await user2.getAddress(), expectedNetAmount, matchId);
      
      await expect(tx).to.emit(tokenHandler, "FeesCollected")
        .withArgs(matchId, feeRecipient, tokenAddress, expectedFee, "protocol");
    });

    it("should execute batch safe transfers atomically", async function () {
      const tokenAddress = await mockERC20.getAddress();
      await mockERC20.connect(user2).approve(await tokenHandler.getAddress(), ethers.parseEther("500"));
      
      const tokens = [tokenAddress, tokenAddress];
      const froms = [await user1.getAddress(), await user2.getAddress()];
      const tos = [await user2.getAddress(), await user1.getAddress()];
      const amounts = [ethers.parseEther("50"), ethers.parseEther("30")];
      
      await expect(
        tokenHandler.batchSafeTransfer(tokens, froms, tos, amounts, matchId)
      ).to.emit(tokenHandler, "TokenTransfer")
        .withArgs(tokens[0], froms[0], tos[0], amounts[0], matchId);
    });

    it("should reject transfer with insufficient validation", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const transferAmount = ethers.parseEther("2000"); // More than balance
      
      await expect(
        tokenHandler.safeTransfer(
          tokenAddress,
          await user1.getAddress(),
          await user2.getAddress(),
          transferAmount,
          matchId
        )
      ).to.be.revertedWithCustomError(tokenHandler, "TokenTransferFailed");
    });
  });

  describe("Emergency Functions", function () {
    beforeEach(async function () {
      const tokenAddress = await mockERC20.getAddress();
      await tokenHandler.addSupportedToken(tokenAddress);
      
      // Send some tokens to the contract for recovery testing
      await mockERC20.connect(user1).transfer(await tokenHandler.getAddress(), ethers.parseEther("100"));
    });

    it("should allow owner to recover stuck ERC20 tokens", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const recoveryAmount = ethers.parseEther("50");
      const recipient = await user2.getAddress();
      
      const initialBalance = await mockERC20.balanceOf(recipient);
      
      await tokenHandler.emergencyRecover(tokenAddress, recipient, recoveryAmount);
      
      const finalBalance = await mockERC20.balanceOf(recipient);
      expect(finalBalance).to.equal(initialBalance + recoveryAmount);
    });

    it("should prevent non-owner from recovering tokens", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const recoveryAmount = ethers.parseEther("50");
      const recipient = await user2.getAddress();
      
      await expect(
        tokenHandler.connect(user1).emergencyRecover(tokenAddress, recipient, recoveryAmount)
      ).to.be.revertedWithCustomError(tokenHandler, "Unauthorized");
    });

    it("should check contract balance", async function () {
      const tokenAddress = await mockERC20.getAddress();
      const contractBalance = await tokenHandler.getContractBalance(tokenAddress);
      expect(contractBalance).to.equal(ethers.parseEther("100"));
    });
  });

  describe("ETH Handling", function () {
    it("should receive ETH", async function () {
      const sendAmount = ethers.parseEther("1");
      
      await expect(
        user1.sendTransaction({
          to: await tokenHandler.getAddress(),
          value: sendAmount
        })
      ).to.not.be.reverted;
      
      const contractBalance = await ethers.provider.getBalance(await tokenHandler.getAddress());
      expect(contractBalance).to.equal(sendAmount);
    });

    it("should reject calls to non-existent functions", async function () {
      await expect(
        user1.sendTransaction({
          to: await tokenHandler.getAddress(),
          data: "0x12345678", // Non-existent function selector
          value: 0
        })
      ).to.be.revertedWith("Function not found");
    });
  });
}); 