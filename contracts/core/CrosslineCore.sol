// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IOrder.sol";
import "../interfaces/ICrosslineCore.sol";
import "../interfaces/ICrosslineEvents.sol";
import "../libraries/OrderValidator.sol";
import "../libraries/SignatureVerifier.sol";

/**
 * @title CrosslineCore
 * @dev Main contract for executing Crossline limit order matches
 * Implements gasless cross-chain limit order settlement
 */
contract CrosslineCore is ICrosslineCore, ICrosslineEvents {
    using OrderValidator for IOrder.Order;
    using SignatureVerifier for IOrder.Order;

    // ============= STATE VARIABLES =============

    /**
     * @dev Contract owner (can update relayer, pause contract)
     */
    address public owner;

    /**
     * @dev Authorized relayer address (backend service)
     * Only relayer can execute matches from the matching engine
     */
    address public relayer;

    /**
     * @dev Contract pause status for emergency stops
     */
    bool public paused;

    /**
     * @dev Mapping to track used nonces for replay protection
     * user address => nonce => used
     */
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    /**
     * @dev Mapping to track cancelled orders
     * orderHash => cancelled
     */
    mapping(bytes32 => bool) public cancelledOrders;

    /**
     * @dev Mapping to track executed matches (prevents double execution)
     * matchId => executed
     */
    mapping(bytes32 => bool) public executedMatches;

    /**
     * @dev Protocol fee recipient address
     */
    address public feeRecipient;

    /**
     * @dev Protocol fee percentage (basis points: 10000 = 100%)
     * Default: 30 basis points = 0.3%
     */
    uint256 public protocolFeeBps;

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
     * @dev Restricts function access to authorized relayer only
     */
    modifier onlyRelayer() {
        if (msg.sender != relayer) {
            revert UnauthorizedRelayer(msg.sender);
        }
        _;
    }

    /**
     * @dev Prevents function execution when contract is paused
     */
    modifier whenNotPaused() {
        if (paused) {
            revert ContractPaused();
        }
        _;
    }

    /**
     * @dev Ensures address is not zero address
     */
    modifier notZeroAddress(address addr) {
        if (addr == address(0)) {
            revert ZeroAddress();
        }
        _;
    }

    // ============= CONSTRUCTOR =============

    /**
     * @dev Initialize the CrosslineCore contract
     * @param _relayer Address of the authorized relayer (backend service)
     * @param _feeRecipient Address to receive protocol fees
     * @param _protocolFeeBps Protocol fee in basis points (30 = 0.3%)
     */
    constructor(
        address _relayer,
        address _feeRecipient,
        uint256 _protocolFeeBps
    ) 
        notZeroAddress(_relayer)
        notZeroAddress(_feeRecipient)
    {
        // Validate fee is reasonable (max 5% = 500 basis points)
        if (_protocolFeeBps > 500) {
            revert InvalidAmount(_protocolFeeBps);
        }

        owner = msg.sender;
        relayer = _relayer;
        feeRecipient = _feeRecipient;
        protocolFeeBps = _protocolFeeBps;
        paused = false;

        // Emit initial setup events
        emit RelayerUpdated(address(0), _relayer, msg.sender);
        emit PauseStatusChanged(false, msg.sender, block.timestamp);
    }

    // ============= VIEW FUNCTIONS =============

    /**
     * @dev Check if an order is valid and not expired
     * @param order The order to validate
     * @return valid True if order can be executed
     */
    function isValidOrder(IOrder.Order memory order) external view returns (bool valid) {
        (bool isValid,) = OrderValidator.isValidOrder(order);
        return isValid;
    }

    /**
     * @dev Get the hash of an order for signature verification
     * @param order The order to hash
     * @return orderHash The EIP-712 compliant hash
     */
    function getOrderHash(IOrder.Order memory order) external view returns (bytes32 orderHash) {
        return SignatureVerifier.getOrderHash(order);
    }

    /**
     * @dev Check if an order has been cancelled
     * @param orderHash Hash of the order to check
     * @return cancelled True if order is cancelled
     */
    function isOrderCancelled(bytes32 orderHash) external view returns (bool cancelled) {
        return cancelledOrders[orderHash];
    }

    /**
     * @dev Check if a nonce has been used (prevents replay)
     * @param user Address of the user
     * @param nonce Nonce to check
     * @return used True if nonce has been used
     */
    function isNonceUsed(address user, uint256 nonce) external view returns (bool used) {
        return usedNonces[user][nonce];
    }

    /**
     * @dev Get current contract configuration
     * @return _owner Contract owner address
     * @return _relayer Authorized relayer address
     * @return _paused Current pause status
     * @return _feeRecipient Fee recipient address
     * @return _protocolFeeBps Protocol fee in basis points
     */
    function getConfig() external view returns (
        address _owner,
        address _relayer,
        bool _paused,
        address _feeRecipient,
        uint256 _protocolFeeBps
    ) {
        return (owner, relayer, paused, feeRecipient, protocolFeeBps);
    }

    // ============= ADMIN FUNCTIONS =============

    /**
     * @dev Update the authorized relayer address
     * @param newRelayer New relayer address
     */
    function updateRelayer(address newRelayer) external onlyOwner notZeroAddress(newRelayer) {
        address oldRelayer = relayer;
        relayer = newRelayer;
        emit RelayerUpdated(oldRelayer, newRelayer, msg.sender);
    }

    /**
     * @dev Pause or unpause the contract
     * @param _paused New pause status
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PauseStatusChanged(_paused, msg.sender, block.timestamp);
    }

    /**
     * @dev Update protocol fee configuration
     * @param newFeeRecipient New fee recipient address
     * @param newFeeBps New fee in basis points (max 500 = 5%)
     */
    function updateFeeConfig(
        address newFeeRecipient, 
        uint256 newFeeBps
    ) external onlyOwner notZeroAddress(newFeeRecipient) {
        if (newFeeBps > 500) {
            revert InvalidAmount(newFeeBps);
        }
        
        feeRecipient = newFeeRecipient;
        protocolFeeBps = newFeeBps;
    }

    /**
     * @dev Transfer ownership to new address
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner notZeroAddress(newOwner) {
        owner = newOwner;
    }

    // ============= CORE FUNCTIONS =============

    /**
     * @dev Execute a matched order pair
     * @param buyOrder The buy order details
     * @param sellOrder The sell order details  
     * @param buySignature Signature from buy order creator
     * @param sellSignature Signature from sell order creator
     * @param matchedAmount Amount to be traded in sell token units
     * @return success True if execution completed successfully
     */
    function executeMatch(
        IOrder.Order memory buyOrder,
        IOrder.Order memory sellOrder,
        bytes memory buySignature,
        bytes memory sellSignature,
        uint256 matchedAmount
    ) external override onlyRelayer whenNotPaused returns (bool success) {
        // Generate match ID for tracking
        bytes32 matchId = keccak256(
            abi.encodePacked(
                SignatureVerifier.getOrderHash(buyOrder),
                SignatureVerifier.getOrderHash(sellOrder),
                matchedAmount,
                block.timestamp
            )
        );

        // Prevent double execution
        if (executedMatches[matchId]) {
            revert MatchAlreadyExecuted(matchId);
        }

        // Validate both orders
        _validateOrderForExecution(buyOrder, buySignature);
        _validateOrderForExecution(sellOrder, sellSignature);

        // Validate match compatibility
        _validateMatchCompatibility(buyOrder, sellOrder, matchedAmount);

        // Calculate amounts for token transfers
        (uint256 sellAmount, uint256 buyAmount) = _calculateTransferAmounts(
            buyOrder,
            sellOrder,
            matchedAmount
        );

        // Mark nonces as used (prevents replay attacks)
        usedNonces[buyOrder.userAddress][buyOrder.nonce] = true;
        usedNonces[sellOrder.userAddress][sellOrder.nonce] = true;

        // Mark match as executed
        executedMatches[matchId] = true;

        // Execute atomic token swap
        _executeTokenSwap(
            buyOrder.userAddress,
            sellOrder.userAddress,
            sellOrder.sellToken,
            buyOrder.sellToken,
            sellAmount,
            buyAmount,
            matchId
        );

        // Emit nonce usage events
        emit NonceUsed(buyOrder.userAddress, buyOrder.nonce, SignatureVerifier.getOrderHash(buyOrder));
        emit NonceUsed(sellOrder.userAddress, sellOrder.nonce, SignatureVerifier.getOrderHash(sellOrder));

        // Emit match execution event
        emit MatchExecuted(
            matchId,
            SignatureVerifier.getOrderHash(buyOrder),
            SignatureVerifier.getOrderHash(sellOrder),
            buyOrder.userAddress,
            sellOrder.userAddress,
            sellOrder.sellToken,
            buyOrder.sellToken,
            sellAmount,
            buyAmount,
            matchedAmount,
            block.timestamp
        );

        return true;
    }

    /**
     * @dev Cancel an order onchain
     * @param orderHash Hash of the order to cancel
     * @param signature Signature proving ownership
     * @return success True if cancellation completed
     */
    function cancelOrder(
        bytes32 orderHash,
        bytes memory signature
    ) external override whenNotPaused returns (bool success) {
        // Verify cancellation signature
        bool isValidSignature = SignatureVerifier.verifyCancellationSignature(
            orderHash,
            msg.sender,
            signature
        );
        
        if (!isValidSignature) {
            revert InvalidSignature(msg.sender, address(0));
        }

        // Check order hasn't already been cancelled
        if (cancelledOrders[orderHash]) {
            revert OrderAlreadyCancelled(orderHash);
        }

        // Mark order as cancelled
        cancelledOrders[orderHash] = true;

        // Emit cancellation event
        emit OrderCancelled(orderHash, msg.sender, block.timestamp);

        return true;
    }

    // ============= ENHANCED NONCE MANAGEMENT =============

    /**
     * @dev Cancel multiple orders in a single transaction (gas efficient)
     * @param orderHashes Array of order hashes to cancel
     * @param signatures Array of corresponding signatures
     * @return success True if all cancellations completed
     */
    function batchCancelOrders(
        bytes32[] calldata orderHashes,
        bytes[] calldata signatures
    ) external whenNotPaused returns (bool success) {
        if (orderHashes.length != signatures.length) {
            revert InvalidAmount(orderHashes.length);
        }

        if (orderHashes.length == 0) {
            revert InvalidAmount(0);
        }

        for (uint256 i = 0; i < orderHashes.length; i++) {
            // Verify cancellation signature for each order
            bool isValidSignature = SignatureVerifier.verifyCancellationSignature(
                orderHashes[i],
                msg.sender,
                signatures[i]
            );
            
            if (!isValidSignature) {
                revert InvalidSignature(msg.sender, address(0));
            }

            // Skip if already cancelled (don't revert, just continue)
            if (cancelledOrders[orderHashes[i]]) {
                continue;
            }

            // Mark order as cancelled
            cancelledOrders[orderHashes[i]] = true;

            // Emit cancellation event
            emit OrderCancelled(orderHashes[i], msg.sender, block.timestamp);
        }

        return true;
    }

    /**
     * @dev Invalidate a range of nonces (prevents future use)
     * Useful for emergency situations or when user wants to cancel many orders
     * @param startNonce Starting nonce to invalidate (inclusive)
     * @param endNonce Ending nonce to invalidate (inclusive)
     */
    function invalidateNonceRange(
        uint256 startNonce,
        uint256 endNonce
    ) external whenNotPaused {
        if (startNonce > endNonce) {
            revert InvalidNonce(msg.sender, startNonce);
        }

        // Reasonable limit to prevent gas limit issues
        if (endNonce - startNonce > 1000) {
            revert InvalidAmount(endNonce - startNonce);
        }

        for (uint256 nonce = startNonce; nonce <= endNonce; nonce++) {
            if (!usedNonces[msg.sender][nonce]) {
                usedNonces[msg.sender][nonce] = true;
                emit NonceUsed(msg.sender, nonce, bytes32(0)); // Empty order hash for manual invalidation
            }
        }
    }

    /**
     * @dev Get the status of multiple nonces at once (gas efficient for frontend)
     * @param user User address to check
     * @param nonces Array of nonces to check
     * @return used Array of boolean values indicating if each nonce is used
     */
    function getNonceStatuses(
        address user,
        uint256[] calldata nonces
    ) external view returns (bool[] memory used) {
        used = new bool[](nonces.length);
        
        for (uint256 i = 0; i < nonces.length; i++) {
            used[i] = usedNonces[user][nonces[i]];
        }
    }

    /**
     * @dev Check if multiple orders are cancelled (batch query for frontend)
     * @param orderHashes Array of order hashes to check
     * @return cancelled Array of boolean values indicating cancellation status
     */
    function getOrderCancellationStatuses(
        bytes32[] calldata orderHashes
    ) external view returns (bool[] memory cancelled) {
        cancelled = new bool[](orderHashes.length);
        
        for (uint256 i = 0; i < orderHashes.length; i++) {
            cancelled[i] = cancelledOrders[orderHashes[i]];
        }
    }

    /**
     * @dev Validate multiple orders at once (useful for frontend validation)
     * @param orders Array of orders to validate
     * @return results Array of validation results (true = valid, false = invalid)
     * @return reasons Array of error messages for invalid orders
     */
    function batchValidateOrders(
        IOrder.Order[] calldata orders
    ) external view returns (bool[] memory results, string[] memory reasons) {
        results = new bool[](orders.length);
        reasons = new string[](orders.length);
        
        for (uint256 i = 0; i < orders.length; i++) {
            (bool isValid, string memory reason) = OrderValidator.isValidOrder(orders[i]);
            results[i] = isValid;
            reasons[i] = reason;
            
            // Additional checks for cancellation and nonce usage
            if (isValid) {
                bytes32 orderHash = SignatureVerifier.getOrderHash(orders[i]);
                
                if (cancelledOrders[orderHash]) {
                    results[i] = false;
                    reasons[i] = "Order cancelled";
                } else if (usedNonces[orders[i].userAddress][orders[i].nonce]) {
                    results[i] = false;
                    reasons[i] = "Nonce already used";
                }
            }
        }
    }

    // ============= EMERGENCY FUNCTIONS =============

    /**
     * @dev Emergency function to mark specific match as executed (admin only)
     * Used for recovery in case of failed execution but successful token transfer
     * @param matchId The match ID to mark as executed
     */
    function emergencyMarkMatchExecuted(bytes32 matchId) external onlyOwner {
        executedMatches[matchId] = true;
        
        // Emit a special event for tracking
        emit MatchExecuted(
            matchId,
            bytes32(0), // Empty order hashes for emergency marking
            bytes32(0),
            address(0),
            address(0),
            address(0),
            address(0),
            0,
            0,
            0,
            block.timestamp
        );
    }

    /**
     * @dev Emergency function to unmark executed match (admin only)
     * Used for recovery in exceptional circumstances
     * @param matchId The match ID to unmark
     */
    function emergencyUnmarkMatchExecuted(bytes32 matchId) external onlyOwner {
        executedMatches[matchId] = false;
    }

    // ============= INTERNAL VALIDATION FUNCTIONS =============

    /**
     * @dev Validate an order for execution
     * @param order The order to validate
     * @param signature The order signature
     */
    function _validateOrderForExecution(
        IOrder.Order memory order,
        bytes memory signature
    ) internal view {
        // Check order structure and expiry
        (bool isValid, string memory reason) = OrderValidator.isValidOrder(order);
        if (!isValid) {
            revert InvalidOrder(reason);
        }

        // Verify signature
        (bool signatureValid, address signer) = SignatureVerifier.verifyOrderSignature(order, signature);
        if (!signatureValid) {
            revert InvalidSignature(order.userAddress, signer);
        }

        // Check nonce hasn't been used
        if (usedNonces[order.userAddress][order.nonce]) {
            revert NonceAlreadyUsed(order.userAddress, order.nonce);
        }

        // Check order hasn't been cancelled
        bytes32 orderHash = SignatureVerifier.getOrderHash(order);
        if (cancelledOrders[orderHash]) {
            revert OrderAlreadyCancelled(orderHash);
        }
    }

    /**
     * @dev Validate that two orders can be matched together
     * @param buyOrder The buy order
     * @param sellOrder The sell order
     * @param matchedAmount The amount to match
     */
    function _validateMatchCompatibility(
        IOrder.Order memory buyOrder,
        IOrder.Order memory sellOrder,
        uint256 matchedAmount
    ) internal pure {
        // Orders must be for the same token pair (but opposite directions)
        if (buyOrder.sellToken != sellOrder.buyToken || buyOrder.buyToken != sellOrder.sellToken) {
            revert InvalidOrder("Token pair mismatch");
        }

        // Users cannot trade with themselves
        if (buyOrder.userAddress == sellOrder.userAddress) {
            revert InvalidOrder("Cannot self-trade");
        }

        // Matched amount must be positive and not exceed order amounts
        if (matchedAmount == 0) {
            revert InvalidAmount(matchedAmount);
        }

        if (matchedAmount > buyOrder.sellAmount || matchedAmount > sellOrder.sellAmount) {
            revert InvalidMatchAmount(matchedAmount, 
                buyOrder.sellAmount < sellOrder.sellAmount ? buyOrder.sellAmount : sellOrder.sellAmount);
        }

        // Price check: ensure buyer is willing to pay seller's price
        // buyOrder price = buyOrder.buyAmount / buyOrder.sellAmount
        // sellOrder price = sellOrder.buyAmount / sellOrder.sellAmount
        // Buy price must be >= sell price
        if (buyOrder.buyAmount * sellOrder.sellAmount < sellOrder.buyAmount * buyOrder.sellAmount) {
            revert InvalidOrder("Price mismatch - buyer price too low");
        }
    }

    /**
     * @dev Calculate actual transfer amounts based on matched amount
     * @param buyOrder The buy order
     * @param sellOrder The sell order  
     * @param matchedAmount Amount being matched (in sell token units)
     * @return sellAmount Amount seller sends
     * @return buyAmount Amount buyer receives
     */
    function _calculateTransferAmounts(
        IOrder.Order memory buyOrder,
        IOrder.Order memory sellOrder,
        uint256 matchedAmount
    ) internal pure returns (uint256 sellAmount, uint256 buyAmount) {
        sellAmount = matchedAmount;
        
        // Calculate buy amount using seller's price (maker gets price preference)
        // buyAmount = matchedAmount * (sellOrder.buyAmount / sellOrder.sellAmount)
        buyAmount = (matchedAmount * sellOrder.buyAmount) / sellOrder.sellAmount;
        
        // Ensure buyer doesn't pay more than their limit
        uint256 buyerMaxPayment = (matchedAmount * buyOrder.buyAmount) / buyOrder.sellAmount;
        if (buyAmount > buyerMaxPayment) {
            buyAmount = buyerMaxPayment;
        }
    }

    /**
     * @dev Execute atomic token swap between two users
     * @param buyer Address of the buyer
     * @param seller Address of the seller
     * @param sellToken Token being sold
     * @param buyToken Token being bought
     * @param sellAmount Amount being sold
     * @param buyAmount Amount being bought
     * @param matchId Match ID for event tracking
     */
    function _executeTokenSwap(
        address buyer,
        address seller,
        address sellToken,
        address buyToken,
        uint256 sellAmount,
        uint256 buyAmount,
        bytes32 matchId
    ) internal {
        // For now, we'll implement a simple approval-based transfer system
        // In production, this would integrate with 1inch Fusion or similar for atomic swaps
        
        // Transfer sell token from seller to buyer
        _safeTransferFrom(sellToken, seller, buyer, sellAmount);
        emit TokenTransfer(sellToken, seller, buyer, sellAmount, matchId);

        // Transfer buy token from buyer to seller  
        _safeTransferFrom(buyToken, buyer, seller, buyAmount);
        emit TokenTransfer(buyToken, buyer, seller, buyAmount, matchId);

        // Collect protocol fee if configured
        if (protocolFeeBps > 0) {
            uint256 protocolFee = (buyAmount * protocolFeeBps) / 10000;
            if (protocolFee > 0) {
                _safeTransferFrom(buyToken, buyer, feeRecipient, protocolFee);
                emit FeesCollected(matchId, feeRecipient, buyToken, protocolFee, "protocol");
            }
        }
    }

    /**
     * @dev Safe ERC20 transfer with proper error handling
     * @param token Token contract address
     * @param from Sender address
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function _safeTransferFrom(
        address token,
        address from,
        address to,
        uint256 amount
    ) internal {
        // For demo purposes, we'll use a simple call
        // In production, use OpenZeppelin's SafeERC20 library
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount)
        );
        
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert TokenTransferFailed(token, from, to, amount);
        }
    }
} 