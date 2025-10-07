// result-formatter.js - Execution Result Formatting Tool
const chalk = require('chalk');

class ResultFormatter {
    constructor() {
        this.styles = {
            success: chalk.green,
            error: chalk.red,
            info: chalk.blue,
            highlight: chalk.cyan,
            muted: chalk.gray
        };

        this.columnWidth = 20; 
    }
    
    /**
     * Format label and value, implement column alignment
     */
    formatLabelValue(label, value) {
        const paddedLabel = label.padEnd(this.columnWidth);
        return `${paddedLabel}${value}`;
    }

    /**
     * Format transaction status
     */
    formatStatus(status) {
        if (status === "Success") {
            return this.formatLabelValue("status", "0x1 Transaction mined and execution succeed");
        } else if (status === "Failed") {
            return this.formatLabelValue("status", "0x0 Transaction mined but execution failed");
        } else {
            return this.formatLabelValue("status", `0x0 ${status}`);
        }
    }

    /**
     * Format transaction hash
     */
    formatTransactionHash(hash) {
        if (!hash) return "-";
        return hash;
    }

    /**
     * Format address display
     */
    formatAddress(address, label = "Address") {
        if (!address) return "-";
        return address;
    }

    /**
     * Format Gas information
     */
    formatGasInfo(gasUsed, gasPrice, transactionCost) {
        const gasUsedFormatted = gasUsed.toLocaleString();
        const gasPriceFormatted = `${(gasPrice / 1e9).toFixed(0)} gwei`;
        const costFormatted = `${(transactionCost / 1e18).toFixed(6)} ETH`;
        
        return [
            this.formatLabelValue("gas cost", `${gasUsedFormatted} gas`)
        ].join('\n');
    }

    /**
     * Format block information
     */
    formatBlockInfo(blockNumber, blockHash) {
        return [
            this.formatLabelValue("block hash", blockHash),
            this.formatLabelValue("block number", blockNumber.toString())
        ].join('\n');
    }

    /**
     * Format input parameters
     */
    formatInputParameters(decodedInput) {
        if (!decodedInput || !decodedInput.parameters) {
            return this.formatLabelValue("decoded input", "-");
        }

        const params = Object.entries(decodedInput.parameters)
            .map(([key, value]) => {
                let formattedValue = value;
                if (typeof value === 'string' && value.startsWith('0x')) {
                    formattedValue = `"${value}"`;
                } else if (typeof value === 'boolean') {
                    formattedValue = value;
                } else if (typeof value === 'number') {
                    formattedValue = value;
                } else {
                    formattedValue = `"${value}"`;
                }
                return `\t\t\t"${key}": ${formattedValue}`;
            })
            .join(',\n');

        return this.formatLabelValue("decoded input", `{\n${params}\n\t\t    }`);
    }

    /**
     * Format event logs
     */
    formatEventLogs(decodedOutput) {
        if (!decodedOutput || decodedOutput.length === 0) {
            return this.formatLabelValue("logs", "[]");
        }

        const logs = decodedOutput.map((log, index) => {
            let argsFormatted = "";
            if (log.args && typeof log.args === 'object') {
                argsFormatted = Object.entries(log.args)
                    .map(([key, value]) => {
                        let formattedValue = value;
                        if (typeof value === 'string' && value.startsWith('0x')) {
                            formattedValue = `"${value}"`;
                        } else if (typeof value === 'boolean') {
                            formattedValue = value;
                        } else if (typeof value === 'number') {
                            formattedValue = value;
                        } else {
                            formattedValue = `"${value}"`;
                        }
                        return `\t\t\t\t  "${key}": ${formattedValue}`;
                    })
                    .join(',\n');
            } else {
                argsFormatted = "\t\t\t\t  -";
            }

            return [
                `\t\t\t{`,
                `\t\t\t  "from": "${log.from}",`,
                `\t\t\t  "topic": "${log.topic}",`,
                `\t\t\t  "event": "${log.event}",`,
                `\t\t\t  "args": {`,
                argsFormatted,
                `\t\t\t\t}`,
                `\t\t\t}`
            ].join('\n');
        }).join(',\n');

        return this.formatLabelValue("logs", `[\n${logs}\n\t\t   ]`);
    }

    /**
     * Format timestamp
     */
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const formattedDate = date.toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        return `timestamp\t${formattedDate}`;
    }

    /**
     * Create separator line
     */
    createSeparator(length = 80, char = '=') {
        return char.repeat(length);
    }

    /**
     * Format title
     */
    formatTitle(title, icon = '') {
        return title;
    }

    /**
     * Format transaction summary
     */
    formatTransactionSummary(summary) {
        return [
            `total transactions\t${summary.totalTransactions}`,
            `successful\t${summary.successful}`,
            `failed\t${summary.failed}`,
            `total cost\t${summary.totalCost.toFixed(6)} ETH`
        ].join('\n');
    }

    /**
     * Format progress bar
     */
    formatProgressBar(current, total, width = 50) {
        const percentage = Math.round((current / total) * 100);
        return `progress\t${percentage}% (${current}/${total})`;
    }

    /**
     * Format error information
     */
    formatError(error) {
        return [
            `error\t${error.message}`,
            `stack\t${error.stack}`
        ].join('\n');
    }

    /**
     * Format success message
     */
    formatSuccess(message) {
        return `success\t${message}`;
    }

    /**
     * Format warning message
     */
    formatWarning(message) {
        return `warning\t${message}`;
    }

    /**
     * Format information
     */
    formatInfo(message) {
        return `${message}`;
    }
}

module.exports = ResultFormatter;