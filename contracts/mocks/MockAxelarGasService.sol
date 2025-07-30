// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockAxelarGasService
 * @dev Mock Axelar gas service for testing purposes
 */
contract MockAxelarGasService {
    
    event NativeGasPaidForContractCall(
        address indexed sourceAddress,
        string destinationChain,
        string destinationAddress,
        bytes32 indexed payloadHash,
        uint256 gasFeeAmount,
        address refundAddress
    );
    
    // Mock gas payment function
    function payNativeGasForContractCall(
        address sender,
        string memory destinationChain,
        string memory destinationAddress,
        bytes memory payload,
        address refundAddress
    ) external payable {
        bytes32 payloadHash = keccak256(payload);
        
        emit NativeGasPaidForContractCall(
            sender,
            destinationChain,
            destinationAddress,
            payloadHash,
            msg.value,
            refundAddress
        );
        
        // For mock, we just accept the payment
        // In real implementation, this would handle gas estimation and payment to relayers
    }
    
    // Mock estimate gas fee function
    function estimateGasFee(
        string memory /*destinationChain*/,
        string memory /*destinationAddress*/,
        bytes memory /*payload*/,
        uint256 /*executionGasLimit*/
    ) external pure returns (uint256) {
        // Return mock gas fee
        return 0.002 ether;
    }
} 