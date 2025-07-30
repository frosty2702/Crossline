// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IOrder.sol";
import "./ICrossChainAdapter.sol";

/**
 * @title ICrosslineCore  
 * @dev Main interface for Crossline order execution contract
 */
interface ICrosslineCore {

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
    ) external returns (bool success);

    /**
     * @dev Cancel an order onchain
     * @param orderHash Hash of the order to cancel
     * @param signature Signature proving ownership
     * @return success True if cancellation completed
     */
    function cancelOrder(
        bytes32 orderHash,
        bytes memory signature
    ) external returns (bool success);

    /**
     * @dev Check if an order has been cancelled
     * @param orderHash Hash of the order to check
     * @return cancelled True if order is cancelled
     */
    function isOrderCancelled(bytes32 orderHash) external view returns (bool cancelled);

    /**
     * @dev Check if a nonce has been used (prevents replay)
     * @param user Address of the user
     * @param nonce Nonce to check
     * @return used True if nonce has been used
     */
    function isNonceUsed(address user, uint256 nonce) external view returns (bool used);

    // ============= CROSS-CHAIN FUNCTIONS =============
    
    /**
     * @dev Execute a cross-chain match received from an adapter
     * @param matchData Cross-chain match data from the adapter
     * @return success True if the match was executed successfully
     */
    function executeCrossChainMatch(
        ICrossChainAdapter.CrossChainMatch calldata matchData
    ) external returns (bool success);

    /**
     * @dev Handle cross-chain settlement confirmation from an adapter
     * @param settlement Settlement data from the adapter
     */
    function handleCrossChainSettlement(
        ICrossChainAdapter.CrossChainSettlement calldata settlement
    ) external;

    /**
     * @dev Set the cross-chain manager contract address
     * @param _crossChainManager Address of the CrossChainManager contract
     */
    function setCrossChainManager(address _crossChainManager) external;

    /**
     * @dev Get the cross-chain manager contract address
     * @return crossChainManager Address of the CrossChainManager contract
     */
    function getCrossChainManager() external view returns (address crossChainManager);
} 