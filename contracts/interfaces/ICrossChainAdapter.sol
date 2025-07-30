// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IOrder.sol";

/**
 * @title ICrossChainAdapter
 * @dev Interface for cross-chain message adapters (LayerZero, Axelar, etc.)
 */
interface ICrossChainAdapter {
    
    // ============= STRUCTS =============
    
    /**
     * @dev Cross-chain match request data
     */
    struct CrossChainMatch {
        bytes32 matchId;
        IOrder.Order buyOrder;
        IOrder.Order sellOrder;
        bytes buySignature;
        bytes sellSignature;
        uint256 matchedAmount;
        address executor;
        uint256 timestamp;
    }

    /**
     * @dev Cross-chain settlement data
     */
    struct CrossChainSettlement {
        bytes32 matchId;
        bool success;
        string reason;
        bytes32 txHash;
        uint256 timestamp;
    }

    // ============= EVENTS =============
    
    event CrossChainMatchSent(
        bytes32 indexed matchId,
        uint256 indexed sourceChain,
        uint256 indexed targetChain,
        address executor
    );
    
    event CrossChainMatchReceived(
        bytes32 indexed matchId,
        uint256 indexed sourceChain,
        address indexed executor
    );
    
    event CrossChainSettlementSent(
        bytes32 indexed matchId,
        uint256 indexed targetChain,
        bool success
    );
    
    event CrossChainSettlementReceived(
        bytes32 indexed matchId,
        uint256 indexed sourceChain,
        bool success
    );

    // ============= FUNCTIONS =============
    
    /**
     * @dev Send cross-chain match execution request
     * @param targetChain Target chain ID
     * @param matchData Match execution data
     * @return messageId Cross-chain message ID
     */
    function sendCrossChainMatch(
        uint256 targetChain,
        CrossChainMatch calldata matchData
    ) external payable returns (bytes32 messageId);

    /**
     * @dev Send cross-chain settlement confirmation
     * @param targetChain Target chain ID  
     * @param settlement Settlement data
     * @return messageId Cross-chain message ID
     */
    function sendCrossChainSettlement(
        uint256 targetChain,
        CrossChainSettlement calldata settlement
    ) external payable returns (bytes32 messageId);

    /**
     * @dev Get estimated cross-chain message cost
     * @param targetChain Target chain ID
     * @param messageType Type of message (0=match, 1=settlement)
     * @return cost Estimated cost in native token
     */
    function estimateCrossChainCost(
        uint256 targetChain,
        uint8 messageType
    ) external view returns (uint256 cost);

    /**
     * @dev Check if chain is supported
     * @param chainId Chain ID to check
     * @return supported True if chain is supported
     */
    function isChainSupported(uint256 chainId) external view returns (bool supported);

    /**
     * @dev Get adapter type identifier
     * @return adapterType Adapter type (e.g., "LayerZero", "Axelar")
     */
    function getAdapterType() external pure returns (string memory adapterType);
} 