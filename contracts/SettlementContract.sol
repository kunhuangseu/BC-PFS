// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SettlementContract
 * @dev Smart contract for handling payments and transaction settlements
 */

// Scheduling contract interface
interface ISchedulingContract {
    function getSchedulingMatrix(address user, address operator) external view returns (bool);
    function getServiceDuration(address user, address operator) external view returns (uint duration);
}

// Registration contract interface
interface IRegistrationContract {
    function getAllUsers() external view returns (address[] memory);
    function getAllOperators() external view returns (address[] memory);
}
contract SettlementContract {
    event PaymentProcessed(address user, address operator, uint cost);
    event ServiceNotified(address user, address operator, uint duration, uint bandwidth);
    
    address public schedulingContract;
    address public registrationContract;
    
    // Rate configuration
    mapping(address => uint) public operatorRates; // Operator rates (wei per second per bandwidth unit)
    
    
    /**
     * @dev Set scheduling contract address
     * @param _schedulingContract Scheduling contract address
     */
    function setSchedulingContract(address _schedulingContract) public {
        schedulingContract = _schedulingContract;
    }
    
    /**
     * @dev Set registration contract address
     * @param _registrationContract Registration contract address
     */
    function setRegistrationContract(address _registrationContract) public {
        registrationContract = _registrationContract;
    }
     
    
    /**
     * @dev Process scheduled transactions
     */
    function processScheduledTransactions() public {
        // Get users and operators from registration contract
        address[] memory currentUsers;
        address[] memory currentOperators;
        
        IRegistrationContract regContract = IRegistrationContract(registrationContract);
        currentUsers = regContract.getAllUsers();
        currentOperators = regContract.getAllOperators();
        
        for (uint n = 0; n < currentUsers.length; n++) {
            for (uint k = 0; k < currentOperators.length; k++) {
                bool scheduled = getSchedulingMatrix(currentUsers[n], currentOperators[k]);
                
                if (scheduled) {
                    (uint duration, uint bandwidth) = getServiceParameters(currentUsers[n], currentOperators[k]);
                    notify(currentUsers[n], currentOperators[k], duration, bandwidth);
                    settleService(currentUsers[n], currentOperators[k], duration, bandwidth);
                }
            }
        }
    }
    
    /**
     * @dev Get scheduling matrix from configured scheduling contract
     */
    function getSchedulingMatrix(address user, address operator) internal view returns (bool) {
        require(schedulingContract != address(0), "SchedulingContract not set");
        ISchedulingContract schedulingInterface = ISchedulingContract(schedulingContract);
        return schedulingInterface.getSchedulingMatrix(user, operator);
    }
    
    /**
     * @dev Service settlement
     * @param user User address
     * @param operator Operator address
     * @param duration Service duration
     * @param bandwidth Bandwidth
     */
    function settleService(address user, address operator, uint duration, uint bandwidth) public {
        uint cost = calculateCost(operator, duration, bandwidth);
        processPayment(user, operator, cost);
        emit PaymentProcessed(user, operator, cost);
    }
    
    /**
     * @dev Notify service parameters
     * @param user User address
     * @param operator Operator address
     * @param duration Service duration
     * @param bandwidth Bandwidth
     */
    function notify(address user, address operator, uint duration, uint bandwidth) internal {
        emit ServiceNotified(user, operator, duration, bandwidth);
    }
    
    /**
     * @dev Get service parameters
     * @param user User address
     * @param operator Operator address
     * @return duration Service duration
     * @return bandwidth Bandwidth
     */
    function getServiceParameters(address user, address operator) public view returns (uint duration, uint bandwidth) {
        // First try to read service parameters from scheduling contract
        if (schedulingContract != address(0)) {
            ISchedulingContract sc = ISchedulingContract(schedulingContract);
            duration = sc.getServiceDuration(user, operator);
        }

        // If scheduling contract does not provide or returns 0, use default value
        if (duration == 0) {
            duration = 50;
        }
        bandwidth = 1000; // Default bandwidth
    }
    
    /**
     * @dev Calculate service cost
     * @param operator Operator address
     * @param duration Service duration
     * @param bandwidth Bandwidth (kHz)
     * @return Total cost
     */
    function calculateCost(address operator, uint duration, uint bandwidth) public view returns (uint) {
        uint rate = operatorRates[operator];
        if (rate == 0) {
            rate = 87; // Default rate
        }
        return rate * duration * bandwidth;
    }
    
    /**
     * @dev Process payment
     * @param user User address
     * @param operator Operator address
     * @param cost Payment amount
     */
    function processPayment(address user, address operator, uint cost) internal {
        // Here should implement actual payment logic
        // For demonstration, we only emit events
        // In actual implementation, may need:
        // 1. Check user balance
        // 2. Deduct fees from user account
        // 3. Transfer to operator account
        // 4. Record transaction history
    }
    
    /**
     * @dev Set operator rate
     * @param operator Operator address
     * @param rate Rate
     */
    function setOperatorRate(address operator, uint rate) public {
        operatorRates[operator] = rate;
    }
}
