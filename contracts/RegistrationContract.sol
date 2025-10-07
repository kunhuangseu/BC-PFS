// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title RegistrationContract
 * @dev Smart contract for handling user and operator registration
 */
contract RegistrationContract {
    struct Info {
        uint id;
        bool isOperator;
    }
    
    uint private nextOpId = 1;
    uint private nextUserId = 1;
    
    mapping(address => Info) public registry;
    
    event RegistrationSuccess(address user, uint id, bool isOperator);
    
    /**
     * @dev Register user or operator
     * @param user User address
     * @param proof Identity verification proof
     * @param isOperator Whether it is an operator
     */
    function register(address user, bytes memory proof, bool isOperator) public {
        // Identity verification
        require(validProof(proof, isOperator), "Invalid credentials");
        
        // Check if already registered
        require(registry[user].id == 0, "User already registered");
        
        // Register
        if (isOperator) {
            registry[user] = Info(nextOpId++, true);
            allOperators.push(user);
        } else {
            registry[user] = Info(nextUserId++, false);
            allUsers.push(user);
        }
        
        emit RegistrationSuccess(user, registry[user].id, isOperator);
    }
    
    /**
     * @dev Verify identity proof
     * @param proof Proof data
     * @param isOperator Whether it is an operator
     * @return Whether verification passes
     */
    function validProof(bytes memory proof, bool isOperator) internal pure returns (bool) {
        // For demonstration, we simplify processing: judge proof validity based on proof length
        // Users need at least 5 bytes proof, operators need longer proof (at least 10 bytes),
        if (isOperator) {
            return proof.length >= 10;
        } else {
            return proof.length >= 5;
        }
    }
    
    /**
     * @dev Get user information
     * @param user User address
     * @return User information struct
     */
    function getUserInfo(address user) public view returns (Info memory) {
        return registry[user];
    }
    
    /**
     * @dev Check if user is registered
     * @param user User address
     * @return Whether registered
     */
    function isRegistered(address user) public view returns (bool) {
        return registry[user].id != 0;
    }
    
    
    // Store all user and operator addresses
    address[] public allUsers;
    address[] public allOperators;
    
    /**
     * @dev Get all user addresses
     * @return User address array
     */
    function getAllUsers() public view returns (address[] memory) {
        return allUsers;
    }
    
    /**
     * @dev Get all operator addresses
     * @return Operator address array
     */
    function getAllOperators() public view returns (address[] memory) {
        return allOperators;
    }
}
