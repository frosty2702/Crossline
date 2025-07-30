// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ICrossChainAdapter.sol";
import "../interfaces/ICrosslineEvents.sol";
// import "@layerzerolabs/contracts/interfaces/ILayerZeroEndpoint.sol";
// import "@layerzerolabs/contracts/interfaces/ILayerZeroReceiver.sol";

// Mock interfaces for demo (replace with real imports when LayerZero is installed)
interface ILayerZeroEndpoint {
    function send(uint16 _dstChainId, bytes memory _destination, bytes memory _payload, address payable _refundAddress, address _zroPaymentAddress, bytes memory _adapterParams) external payable;
    function estimateFees(uint16 _dstChainId, address _userApplication, bytes memory _payload, bool _payInZRO, bytes memory _adapterParam) external view returns (uint256 nativeFee, uint256 zroFee);
}

interface ILayerZeroReceiver {
    function lzReceive(uint16 _srcChainId, bytes memory _srcAddress, uint64 _nonce, bytes memory _payload) external;
}

/**
 * @title LayerZeroAdapter
 * @dev LayerZero implementation for cross-chain messaging
 */
contract LayerZeroAdapter is ICrossChainAdapter, ILayerZeroReceiver, ICrosslineEvents {
    
    // ============= STATE VARIABLES =============
    
    ILayerZeroEndpoint public immutable layerZeroEndpoint;
    address public crosslineCore;
    address public owner;
    
    // Chain ID mappings (Ethereum chain ID -> LayerZero chain ID)
    mapping(uint256 => uint16) public chainIdToLzChainId;
    mapping(uint16 => uint256) public lzChainIdToChainId;
    
    // Trusted remote addresses for each chain
    mapping(uint16 => bytes) public trustedRemotes;
    
    // Message types
    uint8 private constant MSG_TYPE_MATCH = 0;
    uint8 private constant MSG_TYPE_SETTLEMENT = 1;
    
    // Gas limits for different message types
    uint256 public matchExecutionGasLimit = 500000;
    uint256 public settlementGasLimit = 200000;

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
        address _layerZeroEndpoint,
        address _crosslineCore
    ) {
        if (_layerZeroEndpoint == address(0) || _crosslineCore == address(0)) {
            revert InvalidAddress(address(0));
        }
        
        layerZeroEndpoint = ILayerZeroEndpoint(_layerZeroEndpoint);
        crosslineCore = _crosslineCore;
        owner = msg.sender;
        
        // Initialize common chain mappings
        _initializeChainMappings();
    }

    // ============= ADMIN FUNCTIONS =============
    
    function setTrustedRemote(uint16 _lzChainId, bytes calldata _trustedRemote) external onlyOwner {
        trustedRemotes[_lzChainId] = _trustedRemote;
    }
    
    function addChainMapping(uint256 _chainId, uint16 _lzChainId) external onlyOwner {
        chainIdToLzChainId[_chainId] = _lzChainId;
        lzChainIdToChainId[_lzChainId] = _chainId;
    }
    
    function setGasLimits(uint256 _matchGas, uint256 _settlementGas) external onlyOwner {
        matchExecutionGasLimit = _matchGas;
        settlementGasLimit = _settlementGas;
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
        uint16 lzTargetChain = chainIdToLzChainId[targetChain];
        if (lzTargetChain == 0) revert CrossChainNotSupported(targetChain);
        
        bytes memory trustedRemote = trustedRemotes[lzTargetChain];
        if (trustedRemote.length == 0) revert CrossChainNotSupported(targetChain);
        
        // Encode message
        bytes memory payload = abi.encode(MSG_TYPE_MATCH, matchData);
        
        // Send via LayerZero
        layerZeroEndpoint.send{value: msg.value}(
            lzTargetChain,
            trustedRemote,
            payload,
            payable(msg.sender), // refund address
            address(0), // zro payment address
            abi.encodePacked(uint16(1), matchExecutionGasLimit) // adapter params
        );
        
        // Generate message ID (LayerZero doesn't return one directly)
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
        uint16 lzTargetChain = chainIdToLzChainId[targetChain];
        if (lzTargetChain == 0) revert CrossChainNotSupported(targetChain);
        
        bytes memory trustedRemote = trustedRemotes[lzTargetChain];
        if (trustedRemote.length == 0) revert CrossChainNotSupported(targetChain);
        
        // Encode message
        bytes memory payload = abi.encode(MSG_TYPE_SETTLEMENT, settlement);
        
        // Send via LayerZero
        layerZeroEndpoint.send{value: msg.value}(
            lzTargetChain,
            trustedRemote,
            payload,
            payable(msg.sender), // refund address
            address(0), // zro payment address
            abi.encodePacked(uint16(1), settlementGasLimit) // adapter params
        );
        
        // Generate message ID
        messageId = keccak256(abi.encodePacked(
            block.chainid,
            targetChain,
            settlement.matchId,
            block.timestamp
        ));
        
        emit CrossChainSettlementSent(settlement.matchId, targetChain, settlement.success);
    }

    // ============= LAYERZERO RECEIVER =============
    
    function lzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 /*_nonce*/,
        bytes memory _payload
    ) external override {
        if (msg.sender != address(layerZeroEndpoint)) revert Unauthorized("onlyEndpoint");
        
        // Verify trusted remote
        if (keccak256(_srcAddress) != keccak256(trustedRemotes[_srcChainId])) {
            revert Unauthorized("untrustedRemote");
        }
        
        // Decode message
        (uint8 messageType, bytes memory data) = abi.decode(_payload, (uint8, bytes));
        
        uint256 sourceChain = lzChainIdToChainId[_srcChainId];
        
        if (messageType == MSG_TYPE_MATCH) {
            _handleCrossChainMatch(sourceChain, data);
        } else if (messageType == MSG_TYPE_SETTLEMENT) {
            _handleCrossChainSettlement(sourceChain, data);
        } else {
            revert InvalidMessage("unknownMessageType");
        }
    }

    // ============= VIEW FUNCTIONS =============
    
    function estimateCrossChainCost(
        uint256 targetChain,
        uint8 messageType
    ) external view override returns (uint256 cost) {
        uint16 lzTargetChain = chainIdToLzChainId[targetChain];
        if (lzTargetChain == 0) return 0;
        
        uint256 gasLimit = messageType == MSG_TYPE_MATCH ? matchExecutionGasLimit : settlementGasLimit;
        bytes memory adapterParams = abi.encodePacked(uint16(1), gasLimit);
        
        // Create dummy payload for estimation
        bytes memory payload;
        if (messageType == MSG_TYPE_MATCH) {
            CrossChainMatch memory dummyMatch;
            payload = abi.encode(MSG_TYPE_MATCH, dummyMatch);
        } else {
            CrossChainSettlement memory dummySettlement;
            payload = abi.encode(MSG_TYPE_SETTLEMENT, dummySettlement);
        }
        
        (cost, ) = layerZeroEndpoint.estimateFees(
            lzTargetChain,
            address(this),
            payload,
            false, // useZro
            adapterParams
        );
    }
    
    function isChainSupported(uint256 chainId) external view override returns (bool supported) {
        uint16 lzChainId = chainIdToLzChainId[chainId];
        return lzChainId != 0 && trustedRemotes[lzChainId].length > 0;
    }
    
    function getAdapterType() external pure override returns (string memory adapterType) {
        return "LayerZero";
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
        chainIdToLzChainId[1] = 101;
        lzChainIdToChainId[101] = 1;
        
        // Polygon
        chainIdToLzChainId[137] = 109;
        lzChainIdToChainId[109] = 137;
        
        // Arbitrum One
        chainIdToLzChainId[42161] = 110;
        lzChainIdToChainId[110] = 42161;
        
        // Sepolia Testnet
        chainIdToLzChainId[11155111] = 10161;
        lzChainIdToChainId[10161] = 11155111;
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