// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../../contracts/libraries/OrderValidator.sol";
import "../../contracts/interfaces/IOrder.sol";

/**
 * @title OrderValidatorTest
 * @dev Test contract to expose OrderValidator library functions for testing
 */
contract OrderValidatorTest {
    using OrderValidator for IOrder.Order;

    function testValidateOrderStructure(IOrder.Order memory order)
        external
        pure
        returns (bool valid, string memory reason)
    {
        return OrderValidator.validateOrderStructure(order);
    }

    function testIsOrderExpired(IOrder.Order memory order)
        external
        view
        returns (bool expired)
    {
        return OrderValidator.isOrderExpired(order);
    }

    function testValidateChains(uint256 sourceChain, uint256 targetChain)
        external
        pure
        returns (bool valid)
    {
        return OrderValidator.validateChains(sourceChain, targetChain);
    }

    function testIsValidOrder(IOrder.Order memory order)
        external
        view
        returns (bool valid, string memory reason)
    {
        return OrderValidator.isValidOrder(order);
    }

    function testGetOrderPrice(IOrder.Order memory order)
        external
        pure
        returns (uint256 price)
    {
        return OrderValidator.getOrderPrice(order);
    }
} 