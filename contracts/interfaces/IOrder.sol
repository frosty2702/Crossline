// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IOrder
 * @dev Core order structure and interface for Crossline limit orders
 */
interface IOrder {
    
    /**
     * @dev Order structure that matches backend implementation
     * Must be compatible with EIP-712 signing
     */
    struct Order {
        address userAddress;      // Order creator
        address sellToken;        // Token to sell
        address buyToken;         // Token to buy  
        uint256 sellAmount;       // Amount to sell (in wei)
        uint256 buyAmount;        // Minimum amount to receive (in wei)
        uint256 sourceChain;      // Chain where order was created
        uint256 targetChain;      // Chain where order should execute
        uint256 expiry;          // Order expiration timestamp
        uint256 nonce;           // Unique nonce for replay protection
    }

    /**
     * @dev Order status enumeration
     */
    enum OrderStatus {
        Open,           // Available for matching
        Matched,        // Found a match, pending execution  
        PartiallyFilled, // Partially executed
        Filled,         // Completely executed
        Cancelled,      // Cancelled by user
        Expired         // Expired without execution
    }

    /**
     * @dev Check if an order is valid and not expired
     * @param order The order to validate
     * @return valid True if order can be executed
     */
    function isValidOrder(Order memory order) external view returns (bool valid);

    /**
     * @dev Get the hash of an order for signature verification
     * @param order The order to hash
     * @return orderHash The EIP-712 compliant hash
     */
    function getOrderHash(Order memory order) external view returns (bytes32 orderHash);
} 