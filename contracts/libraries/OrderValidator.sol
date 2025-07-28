// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IOrder.sol";

/**
 * @title OrderValidator
 * @dev Library for validating Crossline limit orders
 */
library OrderValidator {

    /**
     * @dev Validate basic order structure and logic
     * @param order The order to validate
     * @return valid True if order passes basic validation
     * @return reason Error message if validation fails
     */
    function validateOrderStructure(IOrder.Order memory order) 
        internal 
        pure 
        returns (bool valid, string memory reason) 
    {
        // Check user address is not zero
        if (order.userAddress == address(0)) {
            return (false, "Invalid user address");
        }

        // Check token addresses are not zero
        if (order.sellToken == address(0)) {
            return (false, "Invalid sell token address");
        }
        
        if (order.buyToken == address(0)) {
            return (false, "Invalid buy token address");
        }

        // Check tokens are different
        if (order.sellToken == order.buyToken) {
            return (false, "Sell and buy tokens must be different");
        }

        // Check amounts are positive
        if (order.sellAmount == 0) {
            return (false, "Sell amount must be positive");
        }
        
        if (order.buyAmount == 0) {
            return (false, "Buy amount must be positive");
        }

        // Check reasonable price bounds (prevent overflow/underflow)
        if (order.sellAmount > type(uint128).max || order.buyAmount > type(uint128).max) {
            return (false, "Amount exceeds maximum limit");
        }

        return (true, "");
    }

    /**
     * @dev Check if an order has expired
     * @param order The order to check
     * @return expired True if order has expired
     */
    function isOrderExpired(IOrder.Order memory order) 
        internal 
        view 
        returns (bool expired) 
    {
        return block.timestamp > order.expiry;
    }

    /**
     * @dev Validate chain IDs are supported
     * @param sourceChain Source chain ID
     * @param targetChain Target chain ID
     * @return valid True if both chains are supported
     */
    function validateChains(uint256 sourceChain, uint256 targetChain) 
        internal 
        pure 
        returns (bool valid) 
    {
        // Supported chain IDs: Ethereum (1), Polygon (137), Arbitrum (42161), Localhost (31337)
        bool validSource = (sourceChain == 1 || sourceChain == 137 || sourceChain == 42161 || sourceChain == 31337);
        bool validTarget = (targetChain == 1 || targetChain == 137 || targetChain == 42161 || targetChain == 31337);
        
        return validSource && validTarget;
    }

    /**
     * @dev Comprehensive order validation
     * @param order The order to validate
     * @return valid True if order is completely valid
     * @return reason Error message if validation fails
     */
    function isValidOrder(IOrder.Order memory order) 
        internal 
        view 
        returns (bool valid, string memory reason) 
    {
        // Check basic structure
        (bool structureValid, string memory structureReason) = validateOrderStructure(order);
        if (!structureValid) {
            return (false, structureReason);
        }

        // Check expiry
        if (isOrderExpired(order)) {
            return (false, "Order has expired");
        }

        // Check chains
        if (!validateChains(order.sourceChain, order.targetChain)) {
            return (false, "Unsupported chain ID");
        }

        // Check expiry is not too far in future (max 30 days)
        if (order.expiry > block.timestamp + 30 days) {
            return (false, "Expiry too far in future");
        }

        return (true, "");
    }

    /**
     * @dev Calculate the price of an order (buyAmount / sellAmount)
     * @param order The order to calculate price for
     * @return price The price with 18 decimal precision
     */
    function getOrderPrice(IOrder.Order memory order) 
        internal 
        pure 
        returns (uint256 price) 
    {
        require(order.sellAmount > 0, "Invalid sell amount");
        
        // Calculate price with 18 decimal precision to avoid rounding errors
        price = (order.buyAmount * 1e18) / order.sellAmount;
    }
} 