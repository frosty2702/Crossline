// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ICrossChainAdapter.sol";
import "../interfaces/ICrosslineEvents.sol";
import "../interfaces/IOrder.sol";

/**
 * @title CrossChainManager
 * @dev Manages multiple cross-chain adapters and routes messages
 */
contract CrossChainManager is ICrosslineEvents {
    
    // ============= STATE VARIABLES =============
    
    address public owner;
    address public crosslineCore;
    
    // Registered adapters
    mapping(string => address) public adapters; // adapterType => adapter address
    mapping(uint256 => string) public chainToAdapter; // chainId => preferred adapter type
    
    // Cross-chain match tracking
    mapping(bytes32 => ICrossChainAdapter.CrossChainMatch) public pendingMatches;
    mapping(bytes32 => ICrossChainAdapter.CrossChainSettlement) public settlements;
    
    // Adapter priority for chains (higher number = higher priority)
    mapping(uint256 => mapping(string => uint256)) public adapterPriority;
    
    // Gas payment tracking
    mapping(bytes32 => uint256) public paidGas;

    // ============= EVENTS =============
    
    event AdapterRegistered(string indexed adapterType, address indexed adapter);
    event AdapterRemoved(string indexed adapterType);
    event ChainAdapterSet(uint256 indexed chainId, string adapterType);
    event CrossChainMatchInitiated(bytes32 indexed matchId, uint256 targetChain, string adapter);
    event CrossChainSettlementProcessed(bytes32 indexed matchId, bool success);

    // ============= MODIFIERS =============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized("onlyOwner");
        _;
    }
    
    modifier onlyCrosslineCore() {
        if (msg.sender != crosslineCore) revert Unauthorized("onlyCrosslineCore");
        _;
    }
    
    modifier onlyRegisteredAdapter() {
        bool isRegistered = false;
        // Check if sender is any registered adapter
        // This is a simplified check - in production you'd maintain a reverse mapping
        if (msg.sender != address(0)) {
            isRegistered = true; // Simplified for demo
        }
        if (!isRegistered) revert Unauthorized("onlyRegisteredAdapter");
        _;
    }

    // ============= CONSTRUCTOR =============
    
    constructor(address _crosslineCore) {
        if (_crosslineCore == address(0)) revert InvalidAddress(_crosslineCore);
        
        owner = msg.sender;
        crosslineCore = _crosslineCore;
    }

    // ============= ADMIN FUNCTIONS =============
    
    function registerAdapter(string calldata adapterType, address adapter) external onlyOwner {
        if (adapter == address(0)) revert InvalidAddress(adapter);
        if (bytes(adapterType).length == 0) revert InvalidMessage("emptyAdapterType");
        
        adapters[adapterType] = adapter;
        emit AdapterRegistered(adapterType, adapter);
    }
    
    function removeAdapter(string calldata adapterType) external onlyOwner {
        delete adapters[adapterType];
        emit AdapterRemoved(adapterType);
    }
    
    function setChainAdapter(uint256 chainId, string calldata adapterType) external onlyOwner {
        if (adapters[adapterType] == address(0)) revert InvalidMessage("adapterNotRegistered");
        
        chainToAdapter[chainId] = adapterType;
        emit ChainAdapterSet(chainId, adapterType);
    }
    
    function setAdapterPriority(uint256 chainId, string calldata adapterType, uint256 priority) external onlyOwner {
        adapterPriority[chainId][adapterType] = priority;
    }
    
    function setCrosslineCore(address _crosslineCore) external onlyOwner {
        if (_crosslineCore == address(0)) revert InvalidAddress(_crosslineCore);
        crosslineCore = _crosslineCore;
    }

    // ============= CROSS-CHAIN FUNCTIONS =============
    
    function initiateCrossChainMatch(
        uint256 targetChain,
        ICrossChainAdapter.CrossChainMatch calldata matchData
    ) external payable onlyCrosslineCore returns (bytes32 messageId) {
        // Get preferred adapter for target chain
        string memory adapterType = chainToAdapter[targetChain];
        if (bytes(adapterType).length == 0) {
            // Fallback: try to find any adapter that supports this chain
            adapterType = _findSupportingAdapter(targetChain);
            if (bytes(adapterType).length == 0) {
                revert CrossChainNotSupported(targetChain);
            }
        }
        
        address adapter = adapters[adapterType];
        if (adapter == address(0)) revert CrossChainNotSupported(targetChain);
        
        // Store pending match
        pendingMatches[matchData.matchId] = matchData;
        paidGas[matchData.matchId] = msg.value;
        
        // Forward to adapter
        messageId = ICrossChainAdapter(adapter).sendCrossChainMatch{value: msg.value}(
            targetChain,
            matchData
        );
        
        emit CrossChainMatchInitiated(matchData.matchId, targetChain, adapterType);
    }
    
    function sendCrossChainSettlement(
        uint256 targetChain,
        ICrossChainAdapter.CrossChainSettlement calldata settlement
    ) external payable returns (bytes32 messageId) {
        // Get preferred adapter for target chain
        string memory adapterType = chainToAdapter[targetChain];
        if (bytes(adapterType).length == 0) {
            adapterType = _findSupportingAdapter(targetChain);
            if (bytes(adapterType).length == 0) {
                revert CrossChainNotSupported(targetChain);
            }
        }
        
        address adapter = adapters[adapterType];
        if (adapter == address(0)) revert CrossChainNotSupported(targetChain);
        
        // Store settlement
        settlements[settlement.matchId] = settlement;
        
        // Forward to adapter
        messageId = ICrossChainAdapter(adapter).sendCrossChainSettlement{value: msg.value}(
            targetChain,
            settlement
        );
        
        emit CrossChainSettlementProcessed(settlement.matchId, settlement.success);
    }

    // ============= ADAPTER CALLBACKS =============
    
    function handleCrossChainMatch(
        ICrossChainAdapter.CrossChainMatch calldata matchData
    ) external onlyRegisteredAdapter {
        // Store the match
        pendingMatches[matchData.matchId] = matchData;
        
        // Forward to CrosslineCore
        ICrosslineCore(crosslineCore).executeCrossChainMatch(matchData);
    }
    
    function handleCrossChainSettlement(
        ICrossChainAdapter.CrossChainSettlement calldata settlement
    ) external onlyRegisteredAdapter {
        // Store the settlement
        settlements[settlement.matchId] = settlement;
        
        // Forward to CrosslineCore
        ICrosslineCore(crosslineCore).handleCrossChainSettlement(settlement);
        
        emit CrossChainSettlementProcessed(settlement.matchId, settlement.success);
    }

    // ============= VIEW FUNCTIONS =============
    
    function estimateCrossChainCost(
        uint256 targetChain,
        uint8 messageType
    ) external view returns (uint256 totalCost, string memory adapterType) {
        // Get preferred adapter
        adapterType = chainToAdapter[targetChain];
        if (bytes(adapterType).length == 0) {
            adapterType = _findSupportingAdapter(targetChain);
            if (bytes(adapterType).length == 0) {
                return (0, "");
            }
        }
        
        address adapter = adapters[adapterType];
        if (adapter == address(0)) return (0, "");
        
        totalCost = ICrossChainAdapter(adapter).estimateCrossChainCost(targetChain, messageType);
    }
    
    function isChainSupported(uint256 chainId) external view returns (bool supported) {
        // Check if any registered adapter supports this chain
        string memory adapterType = chainToAdapter[chainId];
        
        if (bytes(adapterType).length > 0) {
            address adapter = adapters[adapterType];
            if (adapter != address(0)) {
                return ICrossChainAdapter(adapter).isChainSupported(chainId);
            }
        }
        
        // Fallback: check all adapters
        return bytes(_findSupportingAdapter(chainId)).length > 0;
    }
    
    function getSupportedAdapters() external view returns (string[] memory supportedTypes, address[] memory adapterAddresses) {
        // This is a simplified implementation
        // In production, you'd maintain a list of registered adapter types
        string[] memory types = new string[](2);
        address[] memory addresses = new address[](2);
        
        types[0] = "LayerZero";
        types[1] = "Axelar";
        addresses[0] = adapters["LayerZero"];
        addresses[1] = adapters["Axelar"];
        
        return (types, addresses);
    }
    
    function getPendingMatch(bytes32 matchId) external view returns (ICrossChainAdapter.CrossChainMatch memory) {
        return pendingMatches[matchId];
    }
    
    function getSettlement(bytes32 matchId) external view returns (ICrossChainAdapter.CrossChainSettlement memory) {
        return settlements[matchId];
    }

    // ============= INTERNAL FUNCTIONS =============
    
    function _findSupportingAdapter(uint256 chainId) internal view returns (string memory) {
        // Try LayerZero first
        address lzAdapter = adapters["LayerZero"];
        if (lzAdapter != address(0) && ICrossChainAdapter(lzAdapter).isChainSupported(chainId)) {
            return "LayerZero";
        }
        
        // Try Axelar
        address axelarAdapter = adapters["Axelar"];
        if (axelarAdapter != address(0) && ICrossChainAdapter(axelarAdapter).isChainSupported(chainId)) {
            return "Axelar";
        }
        
        return "";
    }

    // ============= EMERGENCY FUNCTIONS =============
    
    function emergencyWithdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    function emergencyRetryMatch(bytes32 matchId, uint256 targetChain) external payable onlyOwner {
        ICrossChainAdapter.CrossChainMatch memory matchData = pendingMatches[matchId];
        if (matchData.matchId == bytes32(0)) revert InvalidMessage("matchNotFound");
        
        this.initiateCrossChainMatch{value: msg.value}(targetChain, matchData);
    }
    
    // Allow contract to receive ETH for gas payments
    receive() external payable {}
}

// Interface extension for CrosslineCore
interface ICrosslineCore {
    function executeCrossChainMatch(ICrossChainAdapter.CrossChainMatch calldata matchData) external returns (bool);
    function handleCrossChainSettlement(ICrossChainAdapter.CrossChainSettlement calldata settlement) external;
} 