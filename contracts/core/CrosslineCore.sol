// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IOrder.sol";
import "../interfaces/ICrosslineCore.sol";
import "../interfaces/ICrosslineEvents.sol";
import "../interfaces/ICrossChainAdapter.sol";
import "../libraries/OrderValidator.sol";
import "../libraries/SignatureVerifier.sol";
import "./TokenHandler.sol";

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
     * @dev Cross-chain manager address (can update cross-chain manager)
     */
    address public crossChainManager;

    /**
     * @dev Contract pause status for emergency stops
     */
    bool public paused;

    /**
     * @dev TokenHandler integration
     */
    TokenHandler public tokenHandler;

    /**
     * @dev Protocol fee recipient address
     */
    address public feeRecipient;

    /**
     * @dev Protocol fee percentage (basis points: 10000 = 100%)
     * Default: 30 basis points = 0.3%
     */
    uint256 public protocolFeeBps;

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
     * @dev Mapping to track pending cross-chain matches
     * matchId => CrossChainMatch data
     */
    mapping(bytes32 => ICrossChainAdapter.CrossChainMatch) public pendingCrossChainMatches;

    /**
     * @dev Mapping to track cross-chain settlements
     * matchId => CrossChainSettlement data
     */
    mapping(bytes32 => ICrossChainAdapter.CrossChainSettlement) public crossChainSettlements;

    // ============= MODIFIERS =============

    /**
     * @dev Restricts function access to contract owner only
     */
    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized("onlyOwner");
        }
        _;
    }

    /**
     * @dev Restricts function access to authorized relayer only
     */
    modifier onlyRelayer() {
        if (msg.sender != relayer) {
            revert Unauthorized("onlyRelayer");
        }
        _;
    }

    /**
     * @dev Restricts function access to cross-chain manager only
     */
    modifier onlyCrossChainManager() {
        if (msg.sender != crossChainManager) {
            revert Unauthorized("onlyCrossChainManager");
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
            revert InvalidAddress(addr);
        }
        _;
    }

    // ============= CONSTRUCTOR =============

    /**
     * @dev Initialize the CrosslineCore contract
     * @param _relayer Address of the authorized relayer (backend service)
     * @param _tokenHandler Address of the TokenHandler contract
     * @param _feeRecipient Address to receive protocol fees
     * @param _protocolFeeBps Protocol fee in basis points (30 = 0.3%)
     */
    constructor(
        address _relayer,
        address _tokenHandler,
        address _feeRecipient,
        uint256 _protocolFeeBps
    ) notZeroAddress(_relayer) notZeroAddress(_tokenHandler) notZeroAddress(_feeRecipient) {
        owner = msg.sender;
        relayer = _relayer;
        tokenHandler = TokenHandler(_tokenHandler);
        feeRecipient = _feeRecipient;
        protocolFeeBps = _protocolFeeBps;
        
        // Validate fee is reasonable (max 5%)
        require(_protocolFeeBps <= 500, "Protocol fee too high");
        
        paused = false;
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
    function isOrderCancelled(bytes32 orderHash) external view override returns (bool cancelled) {
        return cancelledOrders[orderHash];
    }

    /**
     * @dev Check if a nonce has been used (prevents replay)
     * @param user Address of the user
     * @param nonce Nonce to check
     * @return used True if nonce has been used
     */
    function isNonceUsed(address user, uint256 nonce) external view override returns (bool used) {
        return usedNonces[user][nonce];
    }

    /**
     * @dev Check if a match has been executed
     * @param matchId The match ID to check
     * @return executed True if match has been executed
     */
    function isMatchExecuted(bytes32 matchId) external view returns (bool executed) {
        return executedMatches[matchId];
    }

    /**
     * @dev Get the cross-chain manager address
     * @return crossChainManager The address of the cross-chain manager
     */
    function getCrossChainManager() external view override returns (address) {
        return crossChainManager;
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
    function setRelayer(address _relayer) external onlyOwner notZeroAddress(_relayer) {
        address oldRelayer = relayer;
        relayer = _relayer;
        emit RelayerUpdated(oldRelayer, _relayer);
    }

    /**
     * @dev Update the TokenHandler contract address
     * @param newTokenHandler New TokenHandler address
     */
    function setTokenHandler(address _tokenHandler) external onlyOwner notZeroAddress(_tokenHandler) {
        address oldTokenHandler = address(tokenHandler);
        tokenHandler = TokenHandler(_tokenHandler);
        emit TokenHandlerUpdated(oldTokenHandler, _tokenHandler);
    }

    /**
     * @dev Update the cross-chain manager address
     * @param newCrossChainManager New cross-chain manager address
     */
    function setCrossChainManager(address _crossChainManager) external override onlyOwner notZeroAddress(_crossChainManager) {
        crossChainManager = _crossChainManager;
    }

    /**
     * @dev Update protocol fee configuration
     * @param newFeeRecipient New fee recipient address
     * @param newFeeBps New fee in basis points (max 500 = 5%)
     */
    function setProtocolFee(uint256 _feeBps, address _feeRecipient) external onlyOwner notZeroAddress(_feeRecipient) {
        require(_feeBps <= 500, "Protocol fee too high"); // Max 5%
        
        uint256 oldFeeBps = protocolFeeBps;
        address oldFeeRecipient = feeRecipient;
        
        protocolFeeBps = _feeBps;
        feeRecipient = _feeRecipient;
        
        emit ProtocolFeeUpdated(oldFeeBps, _feeBps, oldFeeRecipient, _feeRecipient);
    }

    /**
     * @dev Pause or unpause the contract
     * @param _paused New pause status
     */
    function pause() external onlyOwner {
        paused = true;
        emit ContractPausedEvent(true);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit ContractPausedEvent(false);
    }

    /**
     * @dev Transfer ownership to new address
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner notZeroAddress(newOwner) {
        owner = newOwner;
    }

    // ============= CORE TRADING FUNCTIONS =============

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
        // Generate match ID
        bytes32 matchId = keccak256(abi.encodePacked(
            buyOrder.userAddress,
            sellOrder.userAddress,
            buyOrder.sellToken,
            buyOrder.buyToken,
            matchedAmount,
            block.timestamp,
            block.number
        ));
        
        // Prevent double execution
        if (executedMatches[matchId]) {
            revert MatchAlreadyExecuted(matchId);
        }
        
        // Validate orders for execution
        _validateOrderForExecution(buyOrder, buySignature);
        _validateOrderForExecution(sellOrder, sellSignature);
        
        // Validate match compatibility
        _validateMatchCompatibility(buyOrder, sellOrder, matchedAmount);
        
        // Mark nonces as used
        usedNonces[buyOrder.userAddress][buyOrder.nonce] = true;
        usedNonces[sellOrder.userAddress][sellOrder.nonce] = true;
        
        // Mark match as executed
        executedMatches[matchId] = true;
        
        // Execute token swap with TokenHandler
        _executeTokenSwapWithFees(buyOrder, sellOrder, matchedAmount, matchId);
        
        // Emit events
        emit NonceUsed(buyOrder.userAddress, buyOrder.nonce, buyOrder.getOrderHash());
        emit NonceUsed(sellOrder.userAddress, sellOrder.nonce, sellOrder.getOrderHash());
        
        bytes32 buyOrderHash = buyOrder.getOrderHash();
        bytes32 sellOrderHash = sellOrder.getOrderHash();
        
        emit MatchExecuted(
            matchId,
            buyOrderHash,
            sellOrderHash,
            buyOrder.userAddress,
            sellOrder.userAddress,
            sellOrder.sellToken,
            buyOrder.sellToken,
            matchedAmount,
            _calculateCorrespondingAmount(buyOrder, matchedAmount),
            block.timestamp
        );
        
        return true;
    }

    // ============= CROSS-CHAIN FUNCTIONS =============

    /**
     * @dev Execute a cross-chain matched order pair
     * @param matchData The cross-chain match data
     * @return success True if execution completed successfully
     */
    function executeCrossChainMatch(
        ICrossChainAdapter.CrossChainMatch calldata matchData
    ) external override onlyCrossChainManager whenNotPaused returns (bool success) {
        bytes32 matchId = matchData.matchId;
        
        if (executedMatches[matchId]) {
            revert MatchAlreadyExecuted(matchId);
        }
        
        // Store the cross-chain match data
        pendingCrossChainMatches[matchId] = matchData;
        
        // Validate orders
        _validateOrderForExecution(matchData.buyOrder, matchData.buySignature);
        _validateOrderForExecution(matchData.sellOrder, matchData.sellSignature);
        _validateMatchCompatibility(matchData.buyOrder, matchData.sellOrder, matchData.matchedAmount);
        
        // Mark nonces as used
        usedNonces[matchData.buyOrder.userAddress][matchData.buyOrder.nonce] = true;
        usedNonces[matchData.sellOrder.userAddress][matchData.sellOrder.nonce] = true;
        executedMatches[matchId] = true;
        
        // Execute the token swap
        _executeTokenSwapWithFees(matchData.buyOrder, matchData.sellOrder, matchData.matchedAmount, matchId);
        
        // Emit events
        emit NonceUsed(matchData.buyOrder.userAddress, matchData.buyOrder.nonce, matchData.buyOrder.getOrderHash());
        emit NonceUsed(matchData.sellOrder.userAddress, matchData.sellOrder.nonce, matchData.sellOrder.getOrderHash());
        
        bytes32 buyOrderHash = matchData.buyOrder.getOrderHash();
        bytes32 sellOrderHash = matchData.sellOrder.getOrderHash();
        
        emit MatchExecuted(
            matchId,
            buyOrderHash,
            sellOrderHash,
            matchData.buyOrder.userAddress,
            matchData.sellOrder.userAddress,
            matchData.sellOrder.sellToken,
            matchData.buyOrder.sellToken,
            matchData.matchedAmount,
            _calculateCorrespondingAmount(matchData.buyOrder, matchData.matchedAmount),
            block.timestamp
        );
        
        // Emit cross-chain specific event
        emit CrossChainMatchRequested(
            matchId,
            matchData.buyOrder.sourceChain,
            matchData.buyOrder.targetChain,
            buyOrderHash
        );
        
        return true;
    }

    /**
     * @dev Handle a cross-chain settlement
     * @param settlement The cross-chain settlement data
     */
    function handleCrossChainSettlement(
        ICrossChainAdapter.CrossChainSettlement calldata settlement
    ) external override onlyCrossChainManager {
        bytes32 matchId = settlement.matchId;
        
        // Store the settlement data
        crossChainSettlements[matchId] = settlement;
        
        // Emit settlement event
        if (settlement.success) {
            // Settlement successful
            emit MatchExecuted(
                matchId,
                bytes32(0), // buyOrderHash not available in settlement
                bytes32(0), // sellOrderHash not available in settlement
                address(0), // buyer not available in settlement
                address(0), // seller not available in settlement
                address(0), // sellToken not available in settlement
                address(0), // buyToken not available in settlement
                0, // executedAmount not available in settlement
                0, // correspondingAmount not available in settlement
                settlement.timestamp
            );
        } else {
            // Settlement failed - could emit a failure event if needed
            // For now, just store the failed settlement data
        }
    }

    // ============= ORDER CANCELLATION =============

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
        address signer = SignatureVerifier.recoverSigner(
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", orderHash)),
            signature
        );
        
        // Check if already cancelled
        if (cancelledOrders[orderHash]) {
            revert OrderCancelled(orderHash);
        }
        
        // Mark as cancelled
        cancelledOrders[orderHash] = true;
        
        emit OrderCancelled(orderHash, signer, block.timestamp);
        return true;
    }

    /**
     * @dev Cancel multiple orders in a single transaction
     * @param orderHashes Array of order hashes to cancel
     * @param signatures Array of cancellation signatures
     * @return success True if all cancellations succeeded
     */
    function batchCancelOrders(
        bytes32[] calldata orderHashes,
        bytes[] calldata signatures
    ) external whenNotPaused returns (bool success) {
        require(orderHashes.length == signatures.length, "Array length mismatch");
        
        for (uint256 i = 0; i < orderHashes.length; i++) {
            if (!cancelledOrders[orderHashes[i]]) {
                // Verify signature
                address signer = SignatureVerifier.recoverSigner(
                    keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", orderHashes[i])),
                    signatures[i]
                );
                
                // Mark as cancelled
                cancelledOrders[orderHashes[i]] = true;
                emit OrderCancelled(orderHashes[i], signer, block.timestamp);
            }
        }
        
        return true;
    }

    /**
     * @dev Invalidate a range of nonces for a user
     * @param startNonce Starting nonce (inclusive)
     * @param endNonce Ending nonce (inclusive)
     */
    function invalidateNonceRange(uint256 startNonce, uint256 endNonce) external whenNotPaused {
        require(endNonce >= startNonce, "Invalid nonce range");
        require(endNonce - startNonce <= 1000, "Range too large"); // Prevent gas issues
        
        for (uint256 nonce = startNonce; nonce <= endNonce; nonce++) {
            if (!usedNonces[msg.sender][nonce]) {
                usedNonces[msg.sender][nonce] = true;
                emit NonceUsed(msg.sender, nonce, bytes32(0));
            }
        }
    }

    // ============= BATCH QUERY FUNCTIONS =============

    /**
     * @dev Check status of multiple nonces for a user
     * @param user User address
     * @param nonces Array of nonces to check
     * @return used Array of boolean values indicating if each nonce is used
     */
    function getNonceStatuses(address user, uint256[] calldata nonces) 
        external view returns (bool[] memory used) {
        used = new bool[](nonces.length);
        for (uint256 i = 0; i < nonces.length; i++) {
            used[i] = usedNonces[user][nonces[i]];
        }
        return used;
    }

    /**
     * @dev Check cancellation status of multiple orders
     * @param orderHashes Array of order hashes to check
     * @return cancelled Array of boolean values indicating if each order is cancelled
     */
    function getOrderCancellationStatuses(bytes32[] calldata orderHashes) 
        external view returns (bool[] memory cancelled) {
        cancelled = new bool[](orderHashes.length);
        for (uint256 i = 0; i < orderHashes.length; i++) {
            cancelled[i] = cancelledOrders[orderHashes[i]];
        }
        return cancelled;
    }

    /**
     * @dev Batch validate multiple orders
     * @param orders Array of orders to validate
     * @return results Array of validation results
     * @return reasons Array of failure reasons (empty string if valid)
     */
    function batchValidateOrders(IOrder.Order[] calldata orders) 
        external view returns (bool[] memory results, string[] memory reasons) {
        results = new bool[](orders.length);
        reasons = new string[](orders.length);
        
        for (uint256 i = 0; i < orders.length; i++) {
            (results[i], reasons[i]) = orders[i].isValidOrder();
            
            // Additional checks if basic validation passes
            if (results[i]) {
                bytes32 orderHash = orders[i].getOrderHash();
                if (cancelledOrders[orderHash]) {
                    results[i] = false;
                    reasons[i] = "Order cancelled";
                } else if (usedNonces[orders[i].userAddress][orders[i].nonce]) {
                    results[i] = false;
                    reasons[i] = "Nonce already used";
                }
            }
        }
        return (results, reasons);
    }

    // ============= EMERGENCY FUNCTIONS =============

    /**
     * @dev Emergency function to mark a match as executed (admin only)
     * @param matchId Match ID to mark as executed
     */
    function emergencyMarkMatchExecuted(bytes32 matchId) external onlyOwner {
        executedMatches[matchId] = true;
        emit MatchExecuted(matchId, bytes32(0), bytes32(0), address(0), address(0), address(0), address(0), 0, 0, block.timestamp);
    }

    /**
     * @dev Emergency function to unmark a match as executed (admin only)
     * @param matchId Match ID to unmark
     */
    function emergencyUnmarkMatchExecuted(bytes32 matchId) external onlyOwner {
        executedMatches[matchId] = false;
    }

    // ============= INTERNAL FUNCTIONS =============
    
    /**
     * @dev Execute token swap using TokenHandler with fee collection
     */
    function _executeTokenSwapWithFees(
        IOrder.Order memory buyOrder,
        IOrder.Order memory sellOrder,
        uint256 matchedAmount,
        bytes32 matchId
    ) internal {
        // Calculate corresponding amount for buy order
        uint256 buyAmount = _calculateCorrespondingAmount(buyOrder, matchedAmount);
        
        // Prepare transfer arrays for batch execution
        address[] memory tokens = new address[](2);
        address[] memory froms = new address[](2);
        address[] memory tos = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        
        // Transfer 1: Sell order token (from seller to buyer)
        tokens[0] = sellOrder.sellToken;
        froms[0] = sellOrder.userAddress;
        tos[0] = buyOrder.userAddress;
        amounts[0] = matchedAmount;
        
        // Transfer 2: Buy order token (from buyer to seller)  
        tokens[1] = buyOrder.sellToken;
        froms[1] = buyOrder.userAddress;
        tos[1] = sellOrder.userAddress;
        amounts[1] = buyAmount;
        
        // Execute transfers with fees if protocol fee > 0
        if (protocolFeeBps > 0) {
            // Execute individual transfers with fees
            tokenHandler.safeTransferWithFees(
                tokens[0], froms[0], tos[0], amounts[0],
                feeRecipient, protocolFeeBps, matchId
            );
            
            tokenHandler.safeTransferWithFees(
                tokens[1], froms[1], tos[1], amounts[1],
                feeRecipient, protocolFeeBps, matchId
            );
        } else {
            // Execute batch transfer without fees
            tokenHandler.batchSafeTransfer(tokens, froms, tos, amounts, matchId);
        }
    }
    
    /**
     * @dev Calculate corresponding amount based on price ratio
     */
    function _calculateCorrespondingAmount(
        IOrder.Order memory order,
        uint256 baseAmount
    ) internal pure returns (uint256 correspondingAmount) {
        // Price ratio: buyAmount / sellAmount
        // For a given sellAmount, buyAmount = (sellAmount * order.buyAmount) / order.sellAmount
        correspondingAmount = (baseAmount * order.buyAmount) / order.sellAmount;
    }
    
    /**
     * @dev Validate order for execution
     */
    function _validateOrderForExecution(
        IOrder.Order memory order,
        bytes memory signature
    ) internal view {
        // Validate order structure and expiry
        (bool isValid, string memory reason) = order.isValidOrder();
        if (!isValid) {
            revert InvalidOrder(reason);
        }
        
        // Check if order is cancelled
        bytes32 orderHash = order.getOrderHash();
        if (cancelledOrders[orderHash]) {
            revert OrderCancelled(orderHash);
        }
        
        // Check if nonce is already used
        if (usedNonces[order.userAddress][order.nonce]) {
            revert NonceAlreadyUsed(order.userAddress, order.nonce);
        }
        
        // Verify signature
        (bool validSig, address signer) = order.verifyOrderSignature(signature);
        if (!validSig || signer != order.userAddress) {
            revert InvalidSignature(order.userAddress, signer);
        }
        
        // Validate token support and balances through TokenHandler
        (bool validTransfer, string memory transferReason) = tokenHandler.validateTransfer(
            order.sellToken,
            order.userAddress,
            address(this), // Temporary validation target
            order.sellAmount,
            address(this)
        );
        if (!validTransfer) {
            revert InsufficientBalance(order.userAddress, order.sellToken, order.sellAmount);
        }
    }
    
    /**
     * @dev Validate that two orders can be matched
     */
    function _validateMatchCompatibility(
        IOrder.Order memory buyOrder,
        IOrder.Order memory sellOrder,
        uint256 matchedAmount
    ) internal pure {
        // Check token compatibility (buyOrder.buyToken == sellOrder.sellToken)
        if (buyOrder.buyToken != sellOrder.sellToken) {
            revert OrderMismatch("Token mismatch");
        }
        
        // Check that sellOrder.buyToken == buyOrder.sellToken  
        if (sellOrder.buyToken != buyOrder.sellToken) {
            revert OrderMismatch("Counter-token mismatch");
        }
        
        // Check chain compatibility
        if (buyOrder.sourceChain != sellOrder.targetChain || 
            buyOrder.targetChain != sellOrder.sourceChain) {
            revert CrossChainMismatch(buyOrder.sourceChain, sellOrder.targetChain);
        }
        
        // Validate matched amount doesn't exceed order limits
        if (matchedAmount > sellOrder.sellAmount) {
            revert InvalidAmount("Matched amount exceeds sell order");
        }
        
        uint256 requiredBuyAmount = _calculateCorrespondingAmount(buyOrder, matchedAmount);
        if (requiredBuyAmount > buyOrder.sellAmount) {
            revert InvalidAmount("Required buy amount exceeds buy order");
        }
        
        // Validate price compatibility (buy price >= sell price)
        uint256 buyPrice = (buyOrder.buyAmount * 1e18) / buyOrder.sellAmount;
        uint256 sellPrice = (sellOrder.buyAmount * 1e18) / sellOrder.sellAmount;
        
        if (buyPrice < sellPrice) {
            revert PriceMismatch(buyPrice, sellPrice);
        }
    }
} 