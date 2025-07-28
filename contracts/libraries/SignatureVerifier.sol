// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/IOrder.sol";

/**
 * @title SignatureVerifier
 * @dev Library for EIP-712 signature verification of Crossline orders
 * Matches backend implementation in services/signatureVerification.js
 */
library SignatureVerifier {

    // EIP-712 Domain Separator (matches backend DOMAIN)
    string private constant DOMAIN_NAME = "Crossline";
    string private constant DOMAIN_VERSION = "1";
    
    // EIP-712 Order Type Hash (matches backend ORDER_TYPES)
    bytes32 private constant ORDER_TYPEHASH = keccak256(
        "Order(address userAddress,address sellToken,address buyToken,uint256 sellAmount,uint256 buyAmount,uint256 sourceChain,uint256 targetChain,uint256 expiry,uint256 nonce)"
    );

    /**
     * @dev Get the domain separator for the current chain
     * @return domainSeparator The EIP-712 domain separator
     */
    function getDomainSeparator() internal view returns (bytes32 domainSeparator) {
        domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(DOMAIN_NAME)),
                keccak256(bytes(DOMAIN_VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @dev Get the hash of an order for signature verification
     * @param order The order to hash
     * @return orderHash The EIP-712 compliant hash
     */
    function getOrderHash(IOrder.Order memory order) internal view returns (bytes32 orderHash) {
        // Create struct hash
        bytes32 structHash = keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                order.userAddress,
                order.sellToken,
                order.buyToken,
                order.sellAmount,
                order.buyAmount,
                order.sourceChain,
                order.targetChain,
                order.expiry,
                order.nonce
            )
        );

        // Create EIP-712 hash
        orderHash = keccak256(
            abi.encodePacked(
                "\x19\x01",
                getDomainSeparator(),
                structHash
            )
        );
    }

    /**
     * @dev Verify an order signature
     * @param order The order to verify
     * @param signature The signature to verify (65 bytes)
     * @return valid True if signature is valid
     * @return signer The recovered signer address
     */
    function verifyOrderSignature(
        IOrder.Order memory order,
        bytes memory signature
    ) internal view returns (bool valid, address signer) {
        // Check signature length
        if (signature.length != 65) {
            return (false, address(0));
        }

        // Get order hash
        bytes32 orderHash = getOrderHash(order);

        // Recover signer
        signer = recoverSigner(orderHash, signature);

        // Verify signer matches order creator
        valid = (signer == order.userAddress && signer != address(0));
    }

    /**
     * @dev Recover signer address from hash and signature
     * @param hash The hash that was signed
     * @param signature The signature (65 bytes: r, s, v)
     * @return signer The recovered signer address
     */
    function recoverSigner(
        bytes32 hash,
        bytes memory signature
    ) internal pure returns (address signer) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        // Extract r, s, v from signature
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        // Handle malleable signatures
        if (v < 27) {
            v += 27;
        }

        // Ensure valid recovery ID
        require(v == 27 || v == 28, "Invalid signature recovery ID");

        // Recover address
        signer = ecrecover(hash, v, r, s);
    }

    /**
     * @dev Verify a cancellation signature (simple message signing)
     * @param orderHash The hash of the order to cancel
     * @param user The user requesting cancellation
     * @param signature The cancellation signature
     * @return valid True if cancellation signature is valid
     */
    function verifyCancellationSignature(
        bytes32 orderHash,
        address user,
        bytes memory signature
    ) internal pure returns (bool valid) {
        // Create cancellation message (matches backend implementation)
        string memory message = string(abi.encodePacked("Cancel order: ", toHexString(orderHash)));
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n", uintToString(bytes(message).length), message));

        // Recover signer
        address signer = recoverSigner(messageHash, signature);

        // Verify signer matches user
        valid = (signer == user && signer != address(0));
    }

    /**
     * @dev Convert bytes32 to hex string (for cancellation messages)
     * @param data The bytes32 to convert
     * @return result The hex string representation
     */
    function toHexString(bytes32 data) internal pure returns (string memory result) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        
        for (uint i = 0; i < 32; i++) {
            str[i*2] = alphabet[uint(uint8(data[i] >> 4))];
            str[1+i*2] = alphabet[uint(uint8(data[i] & 0x0f))];
        }
        
        result = string(str);
    }

    /**
     * @dev Convert uint to string
     * @param value The uint to convert
     * @return result The string representation
     */
    function uintToString(uint value) internal pure returns (string memory result) {
        if (value == 0) {
            return "0";
        }
        
        uint temp = value;
        uint digits;
        
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint(value % 10)));
            value /= 10;
        }
        
        result = string(buffer);
    }
} 