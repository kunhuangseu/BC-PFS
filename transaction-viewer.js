// transaction-viewer.js - Execution Result Display Tool
const { ethers } = require("hardhat");
const ResultFormatter = require('./result-formatter');

class TransactionViewer {
    constructor() {
        this.transactionHistory = [];
        this.currentBlockNumber = 0;
        this.formatter = new ResultFormatter();
    }

    /**
     * Capture and display transaction results
     * @param {Object} tx - Transaction object
     * @param {string} description - Transaction description
     * @param {Object} contract - Contract instance
     * @param {string} methodName - Method name
     * @param {Array} args - Method parameters
     */
    async captureTransaction(tx, description, contract, methodName, args = []) {
        try {
            let receipt;
            let txDetails;
            
            // Handle different types of transaction objects
            if (typeof tx.wait === 'function') {
                // Standard ethers.js transaction object
                receipt = await tx.wait();
                txDetails = await ethers.provider.getTransaction(tx.hash);
            } else if (tx.hash) {
                // If hash already exists, get transaction details directly
                txDetails = await ethers.provider.getTransaction(tx.hash);
                receipt = await ethers.provider.getTransactionReceipt(tx.hash);
            } else {
                // If transaction object is incomplete, try to get latest transaction from contract
                const latestBlock = await ethers.provider.getBlockNumber();
                const block = await ethers.provider.getBlock(latestBlock);
                
                if (block.transactions.length > 0) {
                    const latestTxHash = block.transactions[block.transactions.length - 1];
                    txDetails = await ethers.provider.getTransaction(latestTxHash);
                    receipt = await ethers.provider.getTransactionReceipt(latestTxHash);
                } else {
                    throw new Error("Unable to get transaction information");
                }
            }
            
            // Get block information
            const block = await ethers.provider.getBlock(receipt.blockNumber);
            
            // Parse event logs
            const decodedLogs = await this.decodeLogs(receipt.logs, contract);
            
            // Build transaction result object
            const transactionResult = {
                description: description,
                status: receipt.status === 1 ? "Success" : "Failed",
                transactionHash: txDetails.hash,
                blockHash: block.hash,
                blockNumber: receipt.blockNumber,
                from: txDetails.from,
                to: txDetails.to,
                gasUsed: receipt.gasUsed.toString(),
                gasPrice: txDetails.gasPrice ? txDetails.gasPrice.toString() : "0",
                transactionCost: receipt.gasUsed.mul(txDetails.gasPrice || 0).toString(),
                input: txDetails.data,
                output: (String(methodName).toLowerCase() === 'constructor') ? txDetails.data : '0x',
                decodedInput: this.decodeInput(methodName, args),
                decodedOutput: decodedLogs,
                rawLogs: receipt.logs,
                timestamp: new Date(block.timestamp * 1000).toLocaleString('zh-CN'),
                methodName: methodName,
                contractAddress: contract.address || txDetails.to
            };

            // Add to history
            this.transactionHistory.push(transactionResult);
            
            // Display results
            this.displayTransactionResult(transactionResult);
            
            return transactionResult;
        } catch (error) {
            console.error(`❌ Transaction capture failed: ${error.message}`);
            console.error(`❌ Error details:`, error);
            
            // Create a simplified transaction result object
            const fallbackResult = {
                description: description,
                status: "Unknown",
                transactionHash: "Unknown",
                blockHash: "Unknown",
                blockNumber: 0,
                from: "Unknown",
                to: contract.address || "Unknown",
                gasUsed: "0",
                gasPrice: "0",
                transactionCost: "0",
                input: "Unknown",
                output: "-",
                decodedInput: this.decodeInput(methodName, args),
                decodedOutput: [],
                rawLogs: [],
                timestamp: new Date().toLocaleString('en-US'),
                methodName: methodName,
                contractAddress: contract.address || "Unknown"
            };
            
            this.transactionHistory.push(fallbackResult);
            this.displayTransactionResult(fallbackResult);
            
            return fallbackResult;
        }
    }

    /**
     * Decode input parameters
     */
    decodeInput(methodName, args) {
        const decoded = {
            method: methodName,
            parameters: {}
        };

        // Parse parameters based on method name
        switch (methodName) {
            case 'register':
                decoded.parameters = {
                    user: args[0],
                    proof: args[1],
                    isOperator: args[2]
                };
                break;
            case 'submitReport':
                decoded.parameters = {
                    user: args[0],
                    operator: args[1],
                    csi: args[2]
                };
                break;
            case 'updateScheduling':
                decoded.parameters = {};
                break;
            case 'processScheduledTransactions':
                decoded.parameters = {};
                break;
            default:
                decoded.parameters = args;
        }

        return decoded;
    }

    /**
     * Build complete method signature
     */
    buildMethodSignature(methodName, contractAddress) {
        // Check if it's contract deployment (to address is empty or same as contract address)
        if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
            return 'RegistrationContract.(constructor)';
        }
        
        // Ensure methodName is a string
        const method = String(methodName || 'unknown');
        
        // Build complete signature based on method name
        const methodSignatures = {
            'constructor': 'RegistrationContract.(constructor)',
            'register': 'RegistrationContract.register(address,bytes,bool)',
            'submitReport': 'StatusReportingContract.submitReport(address,address,uint256)',
            'updateScheduling': 'SchedulingContract.updateScheduling()',
            'processScheduledTransactions': 'SchedulingContract.processScheduledTransactions()',
            'settle': 'SettlementContract.settle()',
            'setRegistrationContract': 'SchedulingContract.setRegistrationContract(address)',
            'setSchedulingContract': 'SettlementContract.setSchedulingContract(address)',
            'setStatusReportingContract': 'SchedulingContract.setStatusReportingContract(address)'
        };
        
        return methodSignatures[method] || `${method}()`;
    }
    async decodeLogs(logs, contract) {
        const decodedLogs = [];
        
        for (const log of logs) {
            try {
                // Try to decode events
                const parsedLog = contract.interface.parseLog(log);
                if (parsedLog) {
                    // Use actual parameter names to build args (fallback to index if no name)
                    const namedArgs = {};
                    const inputs = parsedLog.eventFragment && parsedLog.eventFragment.inputs
                        ? parsedLog.eventFragment.inputs
                        : [];
                    for (let i = 0; i < parsedLog.args.length; i++) {
                        const key = inputs[i] && inputs[i].name ? inputs[i].name : i.toString();
                        namedArgs[key] = parsedLog.args[i];
                    }
                    
                    decodedLogs.push({
                        from: log.address,
                        topic: log.topics[0],
                        event: parsedLog.name,
                        args: namedArgs
                    });
                } else {
                    // Raw log format
                    decodedLogs.push({
                        from: log.address,
                        topic: log.topics[0],
                        event: "Unknown event",
                        args: log.data
                    });
                }
            } catch (error) {
                // If decoding fails, display raw data
                decodedLogs.push({
                    from: log.address,
                    topic: log.topics[0],
                        event: "Decode failed",
                    args: log.data
                });
            }
        }
        
        return decodedLogs;
    }

    /**
     * Display transaction results (concise format, column aligned)
     */
    displayTransactionResult(result) {
        console.log(this.formatter.formatStatus(result.status));
        console.log(this.formatter.formatLabelValue("transaction hash", result.transactionHash));
        console.log(this.formatter.formatBlockInfo(result.blockNumber, result.blockHash));
        // Deployment transaction: display contract address after block information
        if (String(result.methodName).toLowerCase() === 'constructor' && result.contractAddress) {
            console.log(this.formatter.formatLabelValue("contract address", result.contractAddress));
        }
        console.log(this.formatter.formatLabelValue("from", result.from));
        // Build complete method signature and merge with address on the same line
        const methodSignature = this.buildMethodSignature(result.methodName, result.contractAddress);
        console.log(this.formatter.formatLabelValue("to", `${methodSignature} ${result.contractAddress}`));

        // Only print transaction cost (displayed as gas number)
        const txGas = parseInt(result.gasUsed);
        console.log(this.formatter.formatLabelValue("transaction cost", `${txGas.toLocaleString()} gas`));
        
        // Input data (display beginning and end, replace middle with ...)
        let inputDisplay;
        if (result.input && result.input.length > 10) {
            inputDisplay = result.input.substring(0, 5) + "..." + result.input.substring(result.input.length - 5);
        } else {
            inputDisplay = result.input || '-';
        }
        console.log(this.formatter.formatLabelValue("input", inputDisplay));
        
        // Output abbreviation (constructor may be long), logs on new line
        let outputDisplay = result.output;
        if (typeof outputDisplay === 'string' && outputDisplay.startsWith('0x') && outputDisplay.length > 14) {
            const head = outputDisplay.substring(0, 13); // 0x + 11 chars
            outputDisplay = head + '...';
        }
        console.log(this.formatter.formatLabelValue("output", outputDisplay));
        
        // logs displayed on new line
        if (result.decodedOutput && result.decodedOutput.length > 0) {
            console.log(this.formatter.formatEventLogs(result.decodedOutput));
        } else {
            console.log(this.formatter.formatLabelValue("logs", "[]"));
        }
        
        console.log();
    }
}

module.exports = TransactionViewer;
