// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ICrossChainAdapter.sol";
import "../interfaces/ICrosslineEvents.sol";
import "@axelar-network/axelar-gmp-sdk-solidity/contracts/executable/AxelarExecutable.sol";
import "@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol";

/**
 * @title AxelarAdapter
 * @dev Axelar implementation for cross-chain messaging
 */
contract AxelarAdapter is ICrossChainAdapter, AxelarExecutable, ICrosslineEvents {
    
    // ============= STATE VARIABLES =============
    
    IAxelarGasService public immutable gasService;
    address public crosslineCore;
    address public owner;
    
    // Chain name mappings (Ethereum chain ID -> Axelar chain name)
    mapping(uint256 => string) public chainIdToAxelarChain;
    mapping(string => uint256) public axelarChainToChainId;
    
    // Trusted contract addresses for each chain
    mapping(string => string) public trustedContracts;
    
    // Message types
    uint8 private constant MSG_TYPE_MATCH = 0;
    uint8 private constant MSG_TYPE_SETTLEMENT = 1;
    
    // Gas multiplier for cross-chain calls (to account for execution costs)
    uint256 public gasMultiplier = 3; // 3x the estimated gas

    // ============= MODIFIERS =============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized("onlyOwner");
        _;
    }
    
    modifier onlyCrosslineCore() {
        if (msg.sender != crosslineCore) revert Unauthorized("onlyCrosslineCore");
        _;
    }

    // ============= CONSTRUCTOR =============
    
    constructor(
        address _gateway,
        address _gasService,
        address _crosslineCore
    ) AxelarExecutable(_gateway) {
        if (_gasService == address(0) || _crosslineCore == address(0)) {
            revert InvalidAddress(address(0));
        }
        
        gasService = IAxelarGasService(_gasService);
        crosslineCore = _crosslineCore;
        owner = msg.sender;
        
        // Initialize common chain mappings
        _initializeChainMappings();
    }

    // ============= ADMIN FUNCTIONS =============
    
    function setTrustedContract(string calldata _axelarChain, string calldata _contractAddress) external onlyOwner {
        trustedContracts[_axelarChain] = _contractAddress;
    }
    
    function addChainMapping(uint256 _chainId, string calldata _axelarChain) external onlyOwner {
        chainIdToAxelarChain[_chainId] = _axelarChain;
        axelarChainToChainId[_axelarChain] = _chainId;
    }
    
    function setGasMultiplier(uint256 _multiplier) external onlyOwner {
        require(_multiplier > 0 && _multiplier <= 10, "Invalid multiplier");
        gasMultiplier = _multiplier;
    }
    
    function setCrosslineCore(address _crosslineCore) external onlyOwner {
        if (_crosslineCore == address(0)) revert InvalidAddress(_crosslineCore);
        crosslineCore = _crosslineCore;
    }

    // ============= CROSS-CHAIN FUNCTIONS =============
    
    function sendCrossChainMatch(
        uint256 targetChain,
        CrossChainMatch calldata matchData
    ) external payable override onlyCrosslineCore returns (bytes32 messageId) {
        string memory axelarTargetChain = chainIdToAxelarChain[targetChain];
        if (bytes(axelarTargetChain).length == 0) revert CrossChainNotSupported(targetChain);
        
        string memory trustedContract = trustedContracts[axelarTargetChain];
        if (bytes(trustedContract).length == 0) revert CrossChainNotSupported(targetChain);
        
        // Encode message
        bytes memory payload = abi.encode(MSG_TYPE_MATCH, matchData);
        
        // Pay for gas
        gasService.payNativeGasForContractCall{value: msg.value}(
            address(this),
            axelarTargetChain,
            trustedContract,
            payload,
            msg.sender
        );
        
        // Send via Axelar
        gateway.callContract(axelarTargetChain, trustedContract, payload);
        
        // Generate message ID
        messageId = keccak256(abi.encodePacked(
            block.chainid,
            targetChain,
            matchData.matchId,
            block.timestamp
        ));
        
        emit CrossChainMatchSent(matchData.matchId, block.chainid, targetChain, matchData.executor);
    }
    
    function sendCrossChainSettlement(
        uint256 targetChain,
        CrossChainSettlement calldata settlement
    ) external payable override onlyCrosslineCore returns (bytes32 messageId) {
        string memory axelarTargetChain = chainIdToAxelarChain[targetChain];
        if (bytes(axelarTargetChain).length == 0) revert CrossChainNotSupported(targetChain);
        
        string memory trustedContract = trustedContracts[axelarTargetChain];
        if (bytes(trustedContract).length == 0) revert CrossChainNotSupported(targetChain);
        
        // Encode message
        bytes memory payload = abi.encode(MSG_TYPE_SETTLEMENT, settlement);
        
        // Pay for gas
        gasService.payNativeGasForContractCall{value: msg.value}(
            address(this),
            axelarTargetChain,
            trustedContract,
            payload,
            msg.sender
        );
        
        // Send via Axelar
        gateway.callContract(axelarTargetChain, trustedContract, payload);
        
        // Generate message ID
        messageId = keccak256(abi.encodePacked(
            block.chainid,
            targetChain,
            settlement.matchId,
            block.timestamp
        ));
        
        emit CrossChainSettlementSent(settlement.matchId, targetChain, settlement.success);
    }

    // ============= AXELAR EXECUTABLE =============
    
    function _execute(
        string calldata sourceChain,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        // Verify trusted source
        if (keccak256(bytes(sourceAddress)) != keccak256(bytes(trustedContracts[sourceChain]))) {
            revert Unauthorized("untrustedSource");
        }
        
        // Decode message
        (uint8 messageType, bytes memory data) = abi.decode(payload, (uint8, bytes));
        
        uint256 sourceChainId = axelarChainToChainId[sourceChain];
        if (sourceChainId == 0) revert CrossChainNotSupported(0);
        
        if (messageType == MSG_TYPE_MATCH) {
            _handleCrossChainMatch(sourceChainId, data);
        } else if (messageType == MSG_TYPE_SETTLEMENT) {
            _handleCrossChainSettlement(sourceChainId, data);
        } else {
            revert InvalidMessage("unknownMessageType");
        }
    }

    // ============= VIEW FUNCTIONS =============
    
    function estimateCrossChainCost(
        uint256 targetChain,
        uint8 messageType
    ) external view override returns (uint256 cost) {
        string memory axelarTargetChain = chainIdToAxelarChain[targetChain];
        if (bytes(axelarTargetChain).length == 0) return 0;
        
        // Base gas estimate (simplified - in production would use Axelar's estimation)
        uint256 baseGas = messageType == MSG_TYPE_MATCH ? 500000 : 200000;
        
        // Get current gas price and estimate cost
        // This is a simplified estimation - in production you'd use Axelar's gas estimation
        cost = tx.gasprice * baseGas * gasMultiplier;
    }
    
    function isChainSupported(uint256 chainId) external view override returns (bool supported) {
        string memory axelarChain = chainIdToAxelarChain[chainId];
        return bytes(axelarChain).length > 0 && bytes(trustedContracts[axelarChain]).length > 0;
    }
    
    function getAdapterType() external pure override returns (string memory adapterType) {
        return "Axelar";
    }

    // ============= INTERNAL FUNCTIONS =============
    
    function _handleCrossChainMatch(uint256 sourceChain, bytes memory data) internal {
        CrossChainMatch memory matchData = abi.decode(data, (CrossChainMatch));
        
        emit CrossChainMatchReceived(matchData.matchId, sourceChain, matchData.executor);
        
        // Forward to CrosslineCore for execution
        try ICrosslineCore(crosslineCore).executeCrossChainMatch(matchData) {
            // Success - send settlement confirmation back
            CrossChainSettlement memory settlement = CrossChainSettlement({
                matchId: matchData.matchId,
                success: true,
                reason: "",
                txHash: blockhash(block.number - 1), // Simplified
                timestamp: block.timestamp
            });
            
            // Estimate and send settlement (requires ETH for gas)
            uint256 cost = this.estimateCrossChainCost(sourceChain, MSG_TYPE_SETTLEMENT);
            if (address(this).balance >= cost) {
                this.sendCrossChainSettlement{value: cost}(sourceChain, settlement);
            }
            
        } catch Error(string memory reason) {
            // Failure - send settlement with error
            CrossChainSettlement memory settlement = CrossChainSettlement({
                matchId: matchData.matchId,
                success: false,
                reason: reason,
                txHash: bytes32(0),
                timestamp: block.timestamp
            });
            
            uint256 cost = this.estimateCrossChainCost(sourceChain, MSG_TYPE_SETTLEMENT);
            if (address(this).balance >= cost) {
                this.sendCrossChainSettlement{value: cost}(sourceChain, settlement);
            }
        }
    }
    
    function _handleCrossChainSettlement(uint256 sourceChain, bytes memory data) internal {
        CrossChainSettlement memory settlement = abi.decode(data, (CrossChainSettlement));
        
        emit CrossChainSettlementReceived(settlement.matchId, sourceChain, settlement.success);
        
        // Forward to CrosslineCore for settlement handling
        ICrosslineCore(crosslineCore).handleCrossChainSettlement(settlement);
    }
    
    function _initializeChainMappings() internal {
        // Ethereum Mainnet
        chainIdToAxelarChain[1] = "ethereum";
        axelarChainToChainId["ethereum"] = 1;
        
        // Polygon
        chainIdToAxelarChain[137] = "polygon";
        axelarChainToChainId["polygon"] = 137;
        
        // Arbitrum One
        chainIdToAxelarChain[42161] = "arbitrum";
        axelarChainToChainId["arbitrum"] = 42161;
        
        // Avalanche
        chainIdToAxelarChain[43114] = "avalanche";
        axelarChainToChainId["avalanche"] = 43114;
        
        // Binance Smart Chain
        chainIdToAxelarChain[56] = "binance";
        axelarChainToChainId["binance"] = 56;
    }

    // ============= EMERGENCY FUNCTIONS =============
    
    function emergencyWithdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    // Allow contract to receive ETH for gas payments
    receive() external payable {}
}

// Interface extension for CrosslineCore
interface ICrosslineCore {
    function executeCrossChainMatch(ICrossChainAdapter.CrossChainMatch calldata matchData) external returns (bool);
    function handleCrossChainSettlement(ICrossChainAdapter.CrossChainSettlement calldata settlement) external;
} 