// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockLZEndpoint
 * @dev Mock LayerZero endpoint for testing purposes
 */
contract MockLZEndpoint {
    
    event MessageSent(
        uint16 indexed dstChainId,
        bytes destination,
        bytes payload,
        address refundAddress,
        address zroPaymentAddress,
        bytes adapterParams
    );
    
    event MessageReceived(
        uint16 indexed srcChainId,
        bytes srcAddress,
        uint64 nonce,
        bytes payload
    );
    
    // Mock fee estimation
    function estimateFees(
        uint16 /*_dstChainId*/,
        address /*_userApplication*/,
        bytes memory /*_payload*/,
        bool /*_payInZRO*/,
        bytes memory /*_adapterParam*/
    ) external pure returns (uint256 nativeFee, uint256 zroFee) {
        // Return mock fees
        nativeFee = 0.001 ether;
        zroFee = 0;
    }
    
    // Mock send function
    function send(
        uint16 _dstChainId,
        bytes memory _destination,
        bytes memory _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes memory _adapterParams
    ) external payable {
        emit MessageSent(_dstChainId, _destination, _payload, _refundAddress, _zroPaymentAddress, _adapterParams);
        
        // For testing, we can simulate receiving the message back
        // In real implementation, this would be handled by LayerZero infrastructure
    }
    
    // Mock receive function for testing
    function mockReceive(
        address _receiver,
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) external {
        // Call the receiver's lzReceive function
        (bool success, ) = _receiver.call(
            abi.encodeWithSignature("lzReceive(uint16,bytes,uint64,bytes)", _srcChainId, _srcAddress, _nonce, _payload)
        );
        require(success, "Mock receive failed");
        
        emit MessageReceived(_srcChainId, _srcAddress, _nonce, _payload);
    }
} 