// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MockAxelarGateway
 * @dev Mock Axelar gateway for testing purposes
 */
contract MockAxelarGateway {
    
    event ContractCall(
        address indexed sender,
        string destinationChain,
        string destinationContractAddress,
        bytes32 indexed payloadHash,
        bytes payload
    );
    
    event Executed(bytes32 indexed commandId);
    
    // Mock contract call function
    function callContract(
        string memory destinationChain,
        string memory destinationContractAddress,
        bytes memory payload
    ) external {
        bytes32 payloadHash = keccak256(payload);
        
        emit ContractCall(
            msg.sender,
            destinationChain,
            destinationContractAddress,
            payloadHash,
            payload
        );
    }
    
    // Mock validate contract call function
    function validateContractCall(
        bytes32 /*commandId*/,
        string memory /*sourceChain*/,
        string memory /*sourceAddress*/,
        bytes32 /*payloadHash*/
    ) external pure returns (bool) {
        // Always return true for mock
        return true;
    }
    
    // Mock execute function for testing
    function mockExecute(
        address _receiver,
        bytes32 _commandId,
        string memory _sourceChain,
        string memory _sourceAddress,
        bytes memory _payload
    ) external {
        // Call the receiver's _execute function
        (bool success, ) = _receiver.call(
            abi.encodeWithSignature("execute(bytes32,string,string,bytes)", _commandId, _sourceChain, _sourceAddress, _payload)
        );
        require(success, "Mock execute failed");
        
        emit Executed(_commandId);
    }
} 