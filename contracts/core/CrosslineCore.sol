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

    // ============= CORE FUNCTIONS (TO BE IMPLEMENTED) =============

    /**
     * @dev Execute a matched order pair (implementation in next commit)
     */
    function executeMatch(
        IOrder.Order memory buyOrder,
        IOrder.Order memory sellOrder,
        bytes memory buySignature,
        bytes memory sellSignature,
        uint256 matchedAmount
    ) external virtual override returns (bool success) {
        // Implementation coming in next commit
        revert("Not implemented yet");
    }

    /**
     * @dev Cancel an order onchain (implementation in next commit)
     */
    function cancelOrder(
        bytes32 orderHash,
        bytes memory signature
    ) external virtual override returns (bool success) {
        // Implementation coming in next commit
        revert("Not implemented yet");
    }
} 