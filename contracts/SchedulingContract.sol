// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SchedulingContract
 * @dev Smart contract implementing user selection and scheduling algorithms
 */

// Status reporting contract interface
interface IStatusReportingContract {
    function getLatestRate(address user, address operator) external view returns (uint);
}

// Registration contract interface
interface IRegistrationContract {
    function getAllUsers() external view returns (address[] memory);
    function getAllOperators() external view returns (address[] memory);
}
contract SchedulingContract {
    mapping(address => address) public selectedUser;
    mapping(address => uint) public throughput; // Actually stores values scaled by 100000000 (8 decimal places)
    mapping(address => uint) public throughputRemainder; // Accumulated remainder for precise calculation
    uint public constant alpha = 10000; // Control throughput update speed, larger values change slower
    uint public constant PRECISION = 100000000; // Precision factor for simulating floating point operations (8 decimal places)
    mapping(address => mapping(address => bool)) public schedulingMatrix;
    mapping(address => mapping(address => uint)) public allocatedRate;
    // Service parameters provided for settlement
    mapping(address => mapping(address => uint)) public serviceDuration;
    
    address public statusReportingContract;
    address public registrationContract;
    
    // Store user and operator lists
    address[] public users;
    address[] public operators;
    
    event Scheduled(address[] operators, address[] selectedUsers);
    

    /**
     * @dev Set status reporting contract address
     * @param _statusReportingContract Status reporting contract address
     */
    function setStatusReportingContract(address _statusReportingContract) public {
        statusReportingContract = _statusReportingContract;
    }
    
    /**
     * @dev Set registration contract address
     * @param _registrationContract Registration contract address
     */
    function setRegistrationContract(address _registrationContract) public {
        registrationContract = _registrationContract;
    }
    
    /**
     * @dev Update scheduling
     */
    function updateScheduling() public {
        // Get users and operators from registration contract
        address[] memory currentUsers;
        address[] memory currentOperators;
        
        IRegistrationContract regContract = IRegistrationContract(registrationContract);
        currentUsers = regContract.getAllUsers();
        currentOperators = regContract.getAllOperators();
        
        // User selection
        for (uint k = 0; k < currentOperators.length; k++) {
            address op = currentOperators[k];
            address prev = selectedUser[op];
            
            // Clear previous scheduling
            if (prev != address(0)) {
                schedulingMatrix[prev][op] = false;
                allocatedRate[prev][op] = 0;
            }
            
            selectedUser[op] = address(0);
            uint bestLatestRate = 0;
            uint maxPriority = 0;
            
            // Select best user for each operator
            for (uint n = 0; n < currentUsers.length; n++) {
                uint latestRate = getLatestRate(currentUsers[n], op);
                
                // Calculate priority
                uint priority;
                if (throughput[currentUsers[n]] > 0) {
                    // Note: throughput stores values scaled by 100000000
                    priority = (latestRate * 1000000000) / throughput[currentUsers[n]];
                } else {
                    // When throughput is 0, use rate directly as priority
                    priority = latestRate * 100000000;
                }
                
                if (priority > maxPriority) {
                    maxPriority = priority;
                    selectedUser[op] = currentUsers[n];
                    bestLatestRate = latestRate;
                }
            }
            
            // Update scheduling matrix and allocated rate
            if (selectedUser[op] != address(0)) {
                schedulingMatrix[selectedUser[op]][op] = true;
                allocatedRate[selectedUser[op]][op] = bestLatestRate;
                // Set service duration
                serviceDuration[selectedUser[op]][op] = 35 + (uint(keccak256(abi.encodePacked(block.timestamp, op))) % 16);
            }
        }
        
        // Throughput update
        for (uint n = 0; n < currentUsers.length; n++) {
            uint totalAllocated = 0;
            for (uint k = 0; k < currentOperators.length; k++) {
                if (schedulingMatrix[currentUsers[n]][currentOperators[k]]) {
                    totalAllocated += allocatedRate[currentUsers[n]][currentOperators[k]];
                }
            }
            // Use remainder accumulation precise algorithm, store values scaled by 100000000 to support 8 decimal places
            uint oldThroughput = throughput[currentUsers[n]];
            uint remainder = throughputRemainder[currentUsers[n]];
            
            // Calculate: 9999 * oldThroughput + totalAllocated * 100000000 + previously accumulated remainder
            uint numerator = (alpha - 1) * oldThroughput + totalAllocated * 100000000 + remainder;
            uint newThroughput = numerator / alpha;
            uint newRemainder = numerator % alpha;
            
            throughput[currentUsers[n]] = newThroughput;
            throughputRemainder[currentUsers[n]] = newRemainder;
        }
        
        emit Scheduled(currentOperators, getSelectedUsers(currentOperators));
    }

    /**
     * @dev Service parameters provided for settlement contract to read
     */
    function getServiceDuration(address user, address operator) external view returns (uint duration) {
        duration = serviceDuration[user][operator];
    }
    
    
    /**
     * @dev Get latest rate from configured status reporting contract
     */
    function getLatestRate(address user, address operator) internal view returns (uint) {
        require(statusReportingContract != address(0), "StatusReportingContract not set");
        IStatusReportingContract statusContract = IStatusReportingContract(statusReportingContract);
        return statusContract.getLatestRate(user, operator);
    }
    
    
    /**
     * @dev Get selected users
     * @param operatorList Operator array
     * @return Selected user array
     */
    function getSelectedUsers(address[] memory operatorList) internal view returns (address[] memory) {
        address[] memory selectedUsers = new address[](operatorList.length);
        for (uint i = 0; i < operatorList.length; i++) {
            selectedUsers[i] = selectedUser[operatorList[i]];
        }
        return selectedUsers;
    }
    
    
    /**
     * @dev Get scheduling matrix
     * @param user User address
     * @param operator Operator address
     * @return Whether scheduled
     */
    function getSchedulingMatrix(address user, address operator) public view returns (bool) {
        return schedulingMatrix[user][operator];
    }    
}
