// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICrosslineEvents
 * @dev Events and errors interface for Crossline protocol
 * These events are listened to by the backend for real-time updates
 */
interface ICrosslineEvents {

    // ============= EVENTS =============

    /**
     * @dev Emitted when an order match is executed successfully
     * Backend listens to this event to update match status
     */
    event MatchExecuted(
        bytes32 indexed matchId,
        bytes32 indexed buyOrderHash,
        bytes32 indexed sellOrderHash,
        address buyer,
        address seller,
        address sellToken,
        address buyToken,
        uint256 executedAmount,
        uint256 correspondingAmount,
        uint256 timestamp
    );

    /**
     * @dev Emitted when an order is cancelled onchain
     * Backend listens to update order status
     */
    event OrderCancelled(
        bytes32 indexed orderHash,
        address indexed user,
        uint256 timestamp
    );

    /**
     * @dev Emitted when a nonce is used (prevents replay attacks)
     * Backend can track used nonces
     */
    event NonceUsed(
        address indexed user,
        uint256 indexed nonce,
        bytes32 orderHash
    );

    /**
     * @dev Emitted for cross-chain match requests
     * Triggers cross-chain message sending in backend
     */
    event CrossChainMatchRequested(
        bytes32 indexed matchId,
        uint256 indexed sourceChain,
        uint256 indexed targetChain,
        bytes32 orderHash
    );

    /**
     * @dev Emitted when cross-chain match is received and executed
     * Confirms successful cross-chain execution
     */
    event CrossChainMatchExecuted(
        bytes32 indexed matchId,
        uint256 indexed sourceChain,
        bytes32 buyOrderHash,
        bytes32 sellOrderHash,
        uint256 executedAmount
    );

    /**
     * @dev Emitted when tokens are transferred during execution
     * Useful for tracking individual token movements
     */
    event TokenTransfer(
        address indexed token,
        address indexed from,
        address indexed to,
        uint256 amount,
        bytes32 indexed matchId
    );

    /**
     * @dev Emitted when fees are collected
     * Backend tracks fee collection for analytics
     */
    event FeesCollected(
        bytes32 indexed matchId,
        address indexed recipient,
        address indexed token,
        uint256 amount,
        string feeType // "relayer", "protocol", "gas"
    );

    /**
     * @dev Emitted when relayer address is updated
     * Administrative event for access control
     */
    event RelayerUpdated(address indexed oldRelayer, address indexed newRelayer);
    event TokenHandlerUpdated(address indexed oldHandler, address indexed newHandler);
    event ProtocolFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps, address indexed oldRecipient, address indexed newRecipient);
    event ContractPausedEvent(bool paused);

    // TokenHandler events
    event TokenAdded(address indexed token);
    event TokenRemoved(address indexed token);
    event MinimumBalanceUpdated(address indexed token, uint256 minBalance);

    // ============= CUSTOM ERRORS =============

    /**
     * @dev Order-related errors
     */
    error InvalidOrder(string reason);
    error OrderExpired(uint256 currentTime, uint256 expiry);
    error OrderNotFound(bytes32 orderHash);
    error OrderAlreadyCancelled(bytes32 orderHash);
    error OrderAlreadyExecuted(bytes32 orderHash);
    error InvalidSignature(address expectedSigner, address recoveredSigner);
    error SignatureTooShort(uint256 actualLength);
    error SignatureTooLong(uint256 actualLength);
    error InvalidRecoveryId(uint8 recoveryId);
    error NonceAlreadyUsed(address user, uint256 nonce);
    error InvalidNonce(address user, uint256 nonce);
    error OrderMismatch(string reason);

    /**
     * @dev Token-related errors
     */
    error InsufficientBalance(address token, address user, uint256 required, uint256 available);
    error InsufficientAllowance(address token, address user, uint256 required, uint256 allowed);
    error TokenTransferFailed(address token, address from, address to, uint256 amount);
    error InvalidToken(address token);
    error UnsupportedToken(address token);

    /**
     * @dev Access control errors
     */
    error UnauthorizedRelayer(address caller);
    error UnauthorizedUser(address caller);
    error OnlyOwner(address caller);
    error Unauthorized(string role);
    error InvalidAddress(address addr);

    /**
     * @dev Match execution errors
     */
    error MatchAlreadyExecuted(bytes32 matchId);
    error MatchExpired(bytes32 matchId, uint256 expiry);
    error MatchNotFound(bytes32 matchId);
    error InvalidMatchAmount(uint256 requested, uint256 available);
    error PriceMismatch(uint256 buyPrice, uint256 sellPrice);

    /**
     * @dev Cross-chain errors
     */
    error UnsupportedChain(uint256 chainId);
    error CrossChainMessageFailed(uint256 targetChain, bytes data);
    error InvalidCrossChainMessage(uint256 sourceChain, bytes data);
    error CrossChainMismatch(uint256 sourceChain, uint256 targetChain);
    error CrossChainNotSupported(uint256 chainId);

    /**
     * @dev Contract state errors
     */
    error ContractPaused();
    error ContractNotPaused();
    error ZeroAddress();
    error InvalidAmount(uint256 amount);
    error InvalidAmount(string reason);

    /**
     * @dev Price and calculation errors
     */
    error PriceCalculationError(uint256 sellAmount, uint256 buyAmount);
    error InvalidPriceRange(uint256 price, uint256 minPrice, uint256 maxPrice);
    error ArithmeticOverflow(uint256 a, uint256 b);
    error ArithmeticUnderflow(uint256 a, uint256 b);

    /**
     * @dev Message related errors
     */
    error InvalidMessage(string reason);
} 