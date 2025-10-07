// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;


/**
 * @title StatusReportingContract
 * @dev Smart contract for handling CSI data submission and rate reporting
 */
contract StatusReportingContract {
    mapping(address => mapping(address => uint[])) public operatorUserRates;
    // For other contracts to quickly read latest rate values
    mapping(address => mapping(address => uint)) public latestOperatorUserRate;
    
    event ReportSubmitted(address user, address operator, uint timestamp, uint rate);
    
    /**
     * @dev Submit status report
     * @param user User address
     * @param operator Operator address
     * @param csi CSI data
     */
    function submitReport(address user, address operator, bytes memory csi) public {
        // CSI verification
        require(validCSI(csi), "Invalid CSI data");
        
        // Rate estimation
        uint rate = rateEstimation(csi);
        
        // Update rate (keep historical data for evidence, maintain latest value for high-frequency reading)
        operatorUserRates[user][operator].push(rate);
        latestOperatorUserRate[user][operator] = rate;
        
        emit ReportSubmitted(user, operator, block.timestamp, rate);
    }
    
    /**
     * @dev Verify CSI data
     * @param csi CSI data
     * @return Whether verification passes
     */
    function validCSI(bytes memory csi) internal pure returns (bool) {
        // For demonstration, we simplify processing: CSI length greater than 0 is considered valid
        return csi.length > 0;
    }
    
    /**
     * @dev Rate estimation (based on SNR calculation)
     * @param csi CSI data
     * @return Estimated rate
     */
    function rateEstimation(bytes memory csi) internal pure returns (uint) {
        // CSI data is 8-byte value of SNR*1000000
        require(csi.length >= 8, "Invalid CSI data");
        
        // Convert bytes to uint (8-byte SNR*1000000 value)
        uint snrScaled = 0;
        for (uint i = 0; i < 8; i++) {
            snrScaled = snrScaled * 256 + uint8(csi[i]);
        }
        
        if (snrScaled == 0) {
            snrScaled = 1000000; // Minimum value
        }
        
        // Calculate rate: B * SNR / log(2)
        // B = 1000, log(2) ≈ 0.693
        uint bandwidth = 1000; // Bandwidth
        uint log2 = 693; // log(2) * 1000

        uint denom = log2 * 1000;                // = 693000
        uint numer = bandwidth * snrScaled;      // = 1000 * snrScaled
        uint rate = (numer + denom / 2) / denom; // Round to nearest
        
        return rate;
    }
    
    /**
     * @dev Get latest rate of user to operator
     * @param user User address
     * @param operator Operator address
     * @return Latest rate
     */
    function getLatestRate(address user, address operator) public view returns (uint) {
        return latestOperatorUserRate[user][operator];
    }
}
