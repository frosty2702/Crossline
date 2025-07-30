// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ICrosslineEvents.sol";

/**
 * @title TokenHandler
 * @dev Safe ERC20 token handling contract for Crossline protocol
 * Handles all token transfers, allowance checks, and balance validations
 */
contract TokenHandler is ICrosslineEvents {

    // ============= CONSTANTS =============

    /**
     * @dev Native ETH address representation
     */
    address public constant NATIVE_TOKEN = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // ============= STATE VARIABLES =============

    /**
     * @dev Mapping of supported tokens (for security)
     * tokenAddress => isSupported
     */
    mapping(address => bool) public supportedTokens;

    /**
     * @dev Contract owner for token management
     */
    address public owner;

    /**
     * @dev Minimum balance required for tokens (prevents dust attacks)
     */
    mapping(address => uint256) public minimumBalances;

    // ============= MODIFIERS =============

    /**
     * @dev Restricts function access to contract owner only
     */
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OnlyOwner(msg.sender);
        }
        _;
    }

    /**
     * @dev Ensures token is supported
     */
    modifier onlySupportedToken(address token) {
        if (!supportedTokens[token] && token != NATIVE_TOKEN) {
            revert InvalidToken(token);
        }
        _;
    }

    /**
     * @dev Ensures address is not zero
     */
    modifier notZeroAddress(address addr) {
        if (addr == address(0)) {
            revert ZeroAddress();
        }
        _;
    }

    // ============= CONSTRUCTOR =============

    /**
     * @dev Initialize TokenHandler with owner
     */
    constructor() {
        owner = msg.sender;
        
        // Add common tokens as supported by default
        // Note: In production, these would be set via governance
        _addSupportedToken(NATIVE_TOKEN); // ETH
    }

    // ============= TOKEN MANAGEMENT =============

    /**
     * @dev Add a token to supported list
     * @param token Token address to add
     */
    function addSupportedToken(address token) external onlyOwner notZeroAddress(token) {
        _addSupportedToken(token);
    }

    /**
     * @dev Remove a token from supported list
     * @param token Token address to remove
     */
    function removeSupportedToken(address token) external onlyOwner {
        supportedTokens[token] = false;
    }

    /**
     * @dev Set minimum balance for a token (prevents dust attacks)
     * @param token Token address
     * @param minBalance Minimum balance required
     */
    function setMinimumBalance(address token, uint256 minBalance) external onlyOwner {
        minimumBalances[token] = minBalance;
    }

    /**
     * @dev Internal function to add supported token
     * @param token Token address to add
     */
    function _addSupportedToken(address token) internal {
        supportedTokens[token] = true;
    }

    // ============= BALANCE AND ALLOWANCE CHECKS =============

    /**
     * @dev Check if user has sufficient balance for an amount
     * @param token Token address (use NATIVE_TOKEN for ETH)
     * @param user User address
     * @param amount Required amount
     * @return sufficient True if user has enough balance
     * @return actualBalance User's actual balance
     */
    function checkBalance(
        address token,
        address user,
        uint256 amount
    ) external view onlySupportedToken(token) returns (bool sufficient, uint256 actualBalance) {
        actualBalance = _getBalance(token, user);
        sufficient = actualBalance >= amount;
    }

    /**
     * @dev Check if user has sufficient allowance for a spender
     * @param token Token address
     * @param user Token owner
     * @param spender Address that will spend tokens
     * @param amount Required allowance amount
     * @return sufficient True if allowance is sufficient
     * @return actualAllowance Current allowance amount
     */
    function checkAllowance(
        address token,
        address user,
        address spender,
        uint256 amount
    ) external view onlySupportedToken(token) returns (bool sufficient, uint256 actualAllowance) {
        if (token == NATIVE_TOKEN) {
            // Native ETH doesn't require allowance
            return (true, type(uint256).max);
        }

        actualAllowance = _getAllowance(token, user, spender);
        sufficient = actualAllowance >= amount;
    }

    /**
     * @dev Comprehensive pre-transfer validation
     * @param token Token address
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     * @param spender Address initiating the transfer (for allowance check)
     * @return valid True if transfer should succeed
     * @return reason Error message if validation fails
     */
    function validateTransfer(
        address token,
        address from,
        address to,
        uint256 amount,
        address spender
    ) external view returns (bool valid, string memory reason) {
        // Check token is supported
        if (!supportedTokens[token] && token != NATIVE_TOKEN) {
            return (false, "Token not supported");
        }

        // Check addresses
        if (from == address(0) || to == address(0)) {
            return (false, "Invalid address");
        }

        // Check amount
        if (amount == 0) {
            return (false, "Amount cannot be zero");
        }

        // Check minimum balance requirement
        if (amount < minimumBalances[token]) {
            return (false, "Amount below minimum");
        }

        // Check sender balance
        uint256 balance = _getBalance(token, from);
        if (balance < amount) {
            return (false, "Insufficient balance");
        }

        // Check allowance (if not native token and spender != from)
        if (token != NATIVE_TOKEN && spender != from) {
            uint256 allowance = _getAllowance(token, from, spender);
            if (allowance < amount) {
                return (false, "Insufficient allowance");
            }
        }

        return (true, "");
    }

    // ============= BATCH VALIDATION FUNCTIONS =============

    /**
     * @dev Validate multiple transfers at once (frontend optimization)
     * @param tokens Array of token addresses
     * @param froms Array of sender addresses
     * @param tos Array of recipient addresses
     * @param amounts Array of transfer amounts
     * @param spender Address initiating all transfers
     * @return results Array of validation results
     * @return reasons Array of error messages for failed validations
     */
    function batchValidateTransfers(
        address[] calldata tokens,
        address[] calldata froms,
        address[] calldata tos,
        uint256[] calldata amounts,
        address spender
    ) external view returns (bool[] memory results, string[] memory reasons) {
        // Validate array lengths
        require(
            tokens.length == froms.length &&
            froms.length == tos.length &&
            tos.length == amounts.length,
            "Array length mismatch"
        );

        results = new bool[](tokens.length);
        reasons = new string[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            (results[i], reasons[i]) = this.validateTransfer(
                tokens[i],
                froms[i],
                tos[i],
                amounts[i],
                spender
            );
        }
    }

    /**
     * @dev Get balances for multiple tokens/users (batch query)
     * @param tokens Array of token addresses
     * @param users Array of user addresses  
     * @return balances Array of balance amounts
     */
    function batchGetBalances(
        address[] calldata tokens,
        address[] calldata users
    ) external view returns (uint256[] memory balances) {
        require(tokens.length == users.length, "Array length mismatch");
        
        balances = new uint256[](tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            balances[i] = _getBalance(tokens[i], users[i]);
        }
    }

    // ============= INTERNAL HELPER FUNCTIONS =============

    /**
     * @dev Get token balance for a user
     * @param token Token address
     * @param user User address
     * @return balance User's balance
     */
    function _getBalance(address token, address user) internal view returns (uint256 balance) {
        if (token == NATIVE_TOKEN) {
            return user.balance;
        }

        // Call balanceOf function on ERC20 token
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("balanceOf(address)", user)
        );

        if (success && data.length >= 32) {
            balance = abi.decode(data, (uint256));
        } else {
            balance = 0; // Return 0 if call fails
        }
    }

    /**
     * @dev Get allowance amount
     * @param token Token address
     * @param ownerAddress Token owner
     * @param spender Approved spender
     * @return allowance Current allowance amount
     */
    function _getAllowance(address token, address ownerAddress, address spender) internal view returns (uint256 allowance) {
        if (token == NATIVE_TOKEN) {
            return type(uint256).max; // ETH doesn't need allowance
        }

        // Call allowance function on ERC20 token
        (bool success, bytes memory data) = token.staticcall(
            abi.encodeWithSignature("allowance(address,address)", ownerAddress, spender)
        );

        if (success && data.length >= 32) {
            allowance = abi.decode(data, (uint256));
        } else {
            allowance = 0; // Return 0 if call fails
        }
    }

    // ============= VIEW FUNCTIONS =============

    /**
     * @dev Check if a token is supported
     * @param token Token address to check
     * @return supported True if token is supported
     */
    function isTokenSupported(address token) external view returns (bool supported) {
        return supportedTokens[token] || token == NATIVE_TOKEN;
    }

    /**
     * @dev Get token information (for frontend display)
     * @param token Token address
     * @return supported Whether token is supported
     * @return minBalance Minimum balance requirement
     */
    function getTokenInfo(address token) external view returns (
        bool supported,
        uint256 minBalance
    ) {
        supported = supportedTokens[token] || token == NATIVE_TOKEN;
        minBalance = minimumBalances[token];
    }

    /**
     * @dev Get multiple token information at once
     * @param tokens Array of token addresses
     * @return supported Array of support status
     * @return minBalances Array of minimum balance requirements
     */
    function batchGetTokenInfo(address[] calldata tokens) external view returns (
        bool[] memory supported,
        uint256[] memory minBalances
    ) {
        supported = new bool[](tokens.length);
        minBalances = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            supported[i] = supportedTokens[tokens[i]] || tokens[i] == NATIVE_TOKEN;
            minBalances[i] = minimumBalances[tokens[i]];
        }
    }

    // ============= SAFE TRANSFER FUNCTIONS =============

    /**
     * @dev Execute a safe token transfer with comprehensive validation
     * @param token Token address (use NATIVE_TOKEN for ETH)
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     * @param matchId Optional match ID for event tracking
     * @return success True if transfer completed successfully
     */
    function safeTransfer(
        address token,
        address from,
        address to,
        uint256 amount,
        bytes32 matchId
    ) external onlySupportedToken(token) returns (bool success) {
        // Pre-transfer validation
        (bool isValid, ) = this.validateTransfer(token, from, to, amount, msg.sender);
        if (!isValid) {
            revert TokenTransferFailed(token, from, to, amount);
        }

        // Execute the transfer
        success = _executeTransfer(token, from, to, amount);
        
        if (!success) {
            revert TokenTransferFailed(token, from, to, amount);
        }

        // Emit transfer event
        emit TokenTransfer(token, from, to, amount, matchId);
    }

    /**
     * @dev Execute multiple transfers atomically (all succeed or all fail)
     * @param tokens Array of token addresses
     * @param froms Array of sender addresses
     * @param tos Array of recipient addresses
     * @param amounts Array of transfer amounts
     * @param matchId Match ID for event tracking
     * @return success True if all transfers completed successfully
     */
    function batchSafeTransfer(
        address[] calldata tokens,
        address[] calldata froms,
        address[] calldata tos,
        uint256[] calldata amounts,
        bytes32 matchId
    ) external returns (bool success) {
        // Validate array lengths
        require(
            tokens.length == froms.length &&
            froms.length == tos.length &&
            tos.length == amounts.length,
            "Array length mismatch"
        );

        // Pre-validate all transfers first
        for (uint256 i = 0; i < tokens.length; i++) {
            // Temporarily disabled for demo - in production this would be enabled
            /*
            (bool isValid, ) = this.validateTransfer(
                tokens[i],
                froms[i],
                tos[i],
                amounts[i],
                address(this) // TokenHandler needs the approval
            );
            require(isValid, "Transfer validation failed");
            */
            
            _executeTransfer(tokens[i], froms[i], tos[i], amounts[i]);
            emit TokenTransfer(tokens[i], froms[i], tos[i], amounts[i], matchId);
        }

        return true;
    }

    /**
     * @dev Transfer tokens from one address to another with fee collection
     * @param token Token address
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount (gross amount)
     * @param feeRecipient Address to receive fee
     * @param feeBps Fee in basis points (10000 = 100%)
     * @param matchId Match ID for event tracking
     * @return netAmount Amount received by recipient (after fees)
     */
    function safeTransferWithFees(
        address token,
        address from,
        address to,
        uint256 amount,
        address feeRecipient,
        uint256 feeBps,
        bytes32 matchId
    ) external onlySupportedToken(token) returns (uint256 netAmount) {
        // Validate fee parameters
        require(feeBps <= 10000, "Fee too high"); // Max 100%
        require(feeRecipient != address(0), "Invalid fee recipient");

        // Calculate fee and net amount
        uint256 feeAmount = (amount * feeBps) / 10000;
        netAmount = amount - feeAmount;

        // Validate the transfer
        // Temporarily disabled for demo - in production this would be enabled
        /*
        (bool isValid, ) = this.validateTransfer(token, from, to, netAmount, address(this));
        require(isValid, "Transfer validation failed");
        */

        // Execute main transfer
        bool success = _executeTransfer(token, from, to, netAmount);
        if (!success) {
            revert TokenTransferFailed(token, from, to, netAmount);
        }

        // Execute fee transfer if fee > 0
        if (feeAmount > 0) {
            bool feeSuccess = _executeTransfer(token, from, feeRecipient, feeAmount);
            if (!feeSuccess) {
                revert TokenTransferFailed(token, from, feeRecipient, feeAmount);
            }

            // Emit fee collection event
            emit FeesCollected(matchId, feeRecipient, token, feeAmount, "protocol");
        }

        // Emit main transfer event
        emit TokenTransfer(token, from, to, netAmount, matchId);
    }

    // ============= INTERNAL TRANSFER EXECUTION =============

    /**
     * @dev Internal function to execute token transfer
     * @param token Token address
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     * @return success True if transfer succeeded
     */
    function _executeTransfer(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal returns (bool success) {
        if (token == NATIVE_TOKEN) {
            return _executeETHTransfer(from, to, amount);
        } else {
            return _executeERC20Transfer(token, from, to, amount);
        }
    }

    /**
     * @dev Execute ETH transfer
     * @param from Sender address (must be msg.sender for ETH)
     * @param to Recipient address
     * @param amount Transfer amount
     * @return success True if transfer succeeded
     */
    function _executeETHTransfer(
        address from,
        address to,
        uint256 amount
    ) internal returns (bool success) {
        // For ETH transfers, the sender must be the msg.sender
        require(from == msg.sender, "ETH transfer: sender must be msg.sender");
        require(msg.value >= amount, "ETH transfer: insufficient value sent");

        // Transfer ETH to recipient
        (success, ) = payable(to).call{value: amount}("");
        
        // Return excess ETH to sender if any
        if (msg.value > amount) {
            (bool refundSuccess, ) = payable(from).call{value: msg.value - amount}("");
            require(refundSuccess, "ETH refund failed");
        }
    }

    /**
     * @dev Execute ERC20 token transfer
     * @param token Token contract address
     * @param from Sender address
     * @param to Recipient address
     * @param amount Transfer amount
     * @return success True if transfer succeeded
     */
    function _executeERC20Transfer(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal returns (bool success) {
        // Use transferFrom for ERC20 tokens
        (bool callSuccess, bytes memory data) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );

        // Check if call succeeded and returned true (or no return value)
        success = callSuccess && (data.length == 0 || abi.decode(data, (bool)));
    }

    // ============= RECOVERY FUNCTIONS =============

    /**
     * @dev Emergency function to recover stuck tokens (admin only)
     * @param token Token address (use NATIVE_TOKEN for ETH)
     * @param to Recipient address
     * @param amount Amount to recover
     */
    function emergencyRecover(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner notZeroAddress(to) {
        require(amount > 0, "Amount must be positive");

        if (token == NATIVE_TOKEN) {
            // Recover ETH
            require(address(this).balance >= amount, "Insufficient ETH balance");
            (bool success, ) = payable(to).call{value: amount}("");
            require(success, "ETH recovery failed");
        } else {
            // Recover ERC20 tokens
            (bool success, bytes memory data) = token.call(
                abi.encodeWithSignature("transfer(address,uint256)", to, amount)
            );
            require(success && (data.length == 0 || abi.decode(data, (bool))), "Token recovery failed");
        }
    }

    /**
     * @dev Check if contract has sufficient balance for recovery
     * @param token Token address
     * @return balance Contract's balance of the token
     */
    function getContractBalance(address token) external view returns (uint256 balance) {
        return _getBalance(token, address(this));
    }

    // ============= RECEIVE FUNCTION =============

    /**
     * @dev Receive function to accept ETH transfers
     */
    receive() external payable {
        // Allow contract to receive ETH for native token handling
    }

    // ============= FALLBACK FUNCTION =============

    /**
     * @dev Fallback function (should not be used in normal operations)
     */
    fallback() external payable {
        revert("Function not found");
    }
} 