// bcpfs-runner.js - BC-PFS Platform Running and Management Tool
const { ethers } = require("hardhat");
const { ProgressMonitor } = require('./progress-monitor');
const TransactionViewer = require('./transaction-viewer');
const { initPlatform } = require('./bcpfs-init');
const readline = require('readline');

// Wait for any key to continue
async function waitForAnyKey(promptMsg = "\nPress any key to continue...\n") {
    try {
        process.stdout.write(promptMsg);
        if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
            return await new Promise(resolve => {
                const onData = () => {
                    cleanup();
                    resolve();
                };
                const cleanup = () => {
                    process.stdin.setRawMode(false);
                    process.stdin.pause();
                    process.stdin.removeListener('data', onData);
                };
                process.stdin.setRawMode(true);
                process.stdin.resume();
                process.stdin.once('data', onData);
            });
        }
        // fallback: need to press enter
        await new Promise(resolve => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl.question(promptMsg, () => {
                rl.close();
                resolve(null);
            });
        });
    } catch (_) {
        // If unable to read input, continue directly
    }
}

// Global variables to store contract instances
let registrationContract;
let statusReportingContract;
let schedulingContract;
let settlementContract;

// Progress monitor
let progressMonitor;
// Transaction result viewer
let transactionViewer;
// Initialize transaction viewer
transactionViewer = new TransactionViewer();
// Optional: whether to record throughput data from intermediate runs
const SAVE_DATA = true;

// Call initialization function to get contract instances
async function getContracts() {
    const contracts = await initPlatform();
    
    // Use the returned contract instances directly
    registrationContract = contracts.registrationContract;
    statusReportingContract = contracts.statusReportingContract;
    schedulingContract = contracts.schedulingContract;
    settlementContract = contracts.settlementContract;
}

// Step 1: Register operators and users
async function register() {
    console.log("\n👤 Step 1: Register operators");
    console.log("=============================");
    
    const operator1Tx = await registrationContract.register(
        "0x1234567890123456789012345678901234567890",
        "0x1234567890abcdef1234",
        true
    );
    
    console.log("✅ Operator 1 registered successfully");
    await transactionViewer.captureTransaction(
        operator1Tx, 
        "Register operator 1", 
        registrationContract, 
        "register", 
        ["0x1234567890123456789012345678901234567890", "0x1234567890abcdef1234", true]
    );
    
    const operator2Tx = await registrationContract.register(
        "0x2345678901234567890123456789012345678901",
        "0xfe98dc76ba54ab32cd10",
        true
    );
    console.log("✅ Operator 2 registered successfully");
    await transactionViewer.captureTransaction(
        operator2Tx, 
        "Register operator 2", 
        registrationContract, 
        "register", 
        ["0x2345678901234567890123456789012345678901", "0xfe98dc76ba54ab32cd10", true]
    );

    console.log("\n👤 Step 1: Register users");
    console.log("========================");
    
    const users = [
        { address: "0x4567890123456789012345678901234567890123", proof: "0xabcde12345", name: "User 1" },
        { address: "0x5678901234567890123456789012345678901234", proof: "0xbad0c0ffee", name: "User 2" },
        { address: "0x6789012345678901234567890123456789012345", proof: "0x13579bdf24", name: "User 3" },
        { address: "0x7890123456789012345678901234567890123456", proof: "0x2468ace135", name: "User 4" }
    ];
    
    for (const user of users) {
        const tx = await registrationContract.register(user.address, user.proof, false);
        console.log(`✅ ${user.name} registered successfully`);
        await transactionViewer.captureTransaction(
            tx, 
            `Register ${user.name}`, 
            registrationContract, 
            "register", 
            [user.address, user.proof, false]
        );
    }
    
    console.log("🎉 Step 1 completed!\n");
}


// Baseline SNR matrix (linear values) - 2 operators for 4 users
const SNR_STANDARD = [
    [0.0092, 0.0098, 0.0106, 0.0094],
    [0.0081, 0.0117, 0.0082, 0.0112]
];

// Generate CSI data
function generateCSIData(userNum, operatorIndex) {
    const baseSNR = SNR_STANDARD[operatorIndex][userNum - 1];
    // Exponential distribution sampling (mean=baseSNR)
    const u = Math.random();
    const lambda = 1 / baseSNR;
    const randomSNR = -Math.log(1 - u) / lambda;
    // Convert to 8-byte CSI (scaled by 1e6)
    let snrScaled = Math.round(randomSNR * 1000000);
    const bytes = new Uint8Array(8);
    for (let i = 7; i >= 0; i--) {
        bytes[i] = snrScaled & 0xFF;
        snrScaled >>>= 8;
    }
    return bytes;
}

// Parameters
const fs = 1000; // Sampling rate
const t_total = 3000; // Total time (s)
const tc = 50; // Scheduling interval (ms)
const totalRounds = Math.floor(fs * t_total / tc); // Total rounds
const throughputSamples = [];

console.log(`⏰ Parameter settings:`);
console.log(`  Number of networks: 2`);
console.log(`  Total users: 4`);
console.log(`  Scheduling interval: ${tc} ms`);
console.log(`  Scheduling rounds: ${totalRounds} rounds`);

// Multi-round scheduling loop function
async function runSchedulingRounds() {
    console.log(`🔄 Starting multi-round scheduling loop (${totalRounds} rounds total)`);
    console.log("=============================================");
    
    // Initialize progress monitor
    progressMonitor = new ProgressMonitor();
    progressMonitor.init(totalRounds);
    
    // Address configuration
    const ADDRESSES = {
        users: [
            "0x4567890123456789012345678901234567890123",
            "0x5678901234567890123456789012345678901234", 
            "0x6789012345678901234567890123456789012345",
            "0x7890123456789012345678901234567890123456"
        ],
        operators: [
            "0x1234567890123456789012345678901234567890",
            "0x2345678901234567890123456789012345678901"
        ]
    };
    
    const { users, operators } = ADDRESSES;
    
    // Record initial state (round 0, all user throughput is 0)
    if (SAVE_DATA) {
        throughputSamples.push({ 
            round: 0, 
            throughputs: new Array(users.length).fill(0) 
        });
    }

    for (let round = 1; round <= totalRounds; round++) {
        const isDetailedRound = (round >= 499 && round <= 500) || (round === totalRounds);

        try {            
            // Collect transactions that need to be output uniformly after mining
            const detailedTxs = [];
            
            // Switch to manual mining mode to ensure each round of scheduling is packaged into one block
            await ethers.provider.send("evm_setAutomine", [false]);
            // Step 1: CSI data reporting
            const reportSendPromises = users.flatMap((user, i) =>
                operators.map(async (operator, j) => {
                    const csiData = generateCSIData(i + 1, j);
                    const tx = await statusReportingContract.submitReport(user, operator, csiData);
                    if (isDetailedRound) {
                        detailedTxs.push({
                            tx,
                            desc: `Round ${round}-User ${i+1} rate report to operator ${j+1}`,
                            contract: statusReportingContract,
                            method: "submitReport",
                            args: [user, operator, csiData]
                        });
                    }
                    return tx;
                })
            );
            // Ensure all reporting transactions have been sent
            await Promise.all(reportSendPromises);

            
            const prevThroughputNums = new Array(users.length).fill(0);            
            if  (isDetailedRound){
            // Before settlement processing, snapshot "previous round throughput" (for priority denominator)
            const prevTpPromises = users.map(async (user, i) => {
                try {
                    const tp = await schedulingContract.throughput(user);
                    const tpStr = ethers.utils.formatUnits(tp, 8);
                    prevThroughputNums[i] = Number(tpStr);
                } catch (_) {
                    prevThroughputNums[i] = 0;
                }
            });
            await Promise.all(prevTpPromises);
            }

            // Step 2: User scheduling
            const schedulingTx = await schedulingContract.updateScheduling();
            if (isDetailedRound) {
                detailedTxs.push({
                    tx: schedulingTx,
                    desc: `Round ${round}-User scheduling`,
                    contract: schedulingContract,
                    method: "updateScheduling",
                    args: []
                });
            }

            // Step 3: Settlement processing
            const settlementTx = await settlementContract.processScheduledTransactions();
            if (isDetailedRound) {
                detailedTxs.push({
                    tx: settlementTx,
                    desc: `Round ${round}-Settlement processing`,
                    contract: settlementContract,
                    method: "processScheduledTransactions",
                    args: []
                });
            }
            
            // Mining: pack the three types of transactions from this round into the same block
            await ethers.provider.send("evm_mine", []);
            if (round == 1){
                await ethers.provider.send("evm_mine", []);
            }

            // Detailed round: output transaction results in batches after block generation
            if (isDetailedRound) {
                console.log(`\n📘 Round ${round} scheduling`);
                console.log("----------------------------------------");

                const batches = [
                    { method: "submitReport", title: "2️⃣   Step 2 User status reporting" },
                    { method: "updateScheduling", title: "3️⃣   Step 3 User scheduling" },
                    { method: "processScheduledTransactions", title: "4️⃣   Step 4 Transaction settlement" }
                ];

                for (const batch of batches) {
                    const items = detailedTxs.filter(d => d.method === batch.method);
                    if (items.length === 0) continue;
                    console.log(batch.title);
                    for (const item of items) {
                        if (batch.method === "submitReport") {
                            try {
                                const userAddr = item.args && item.args[0];
                                const opAddr = item.args && item.args[1];
                                const ui = users.findIndex(u => u.toLowerCase() === String(userAddr).toLowerCase());
                                const oi = operators.findIndex(o => o.toLowerCase() === String(opAddr).toLowerCase());
                                const userLabel = ui >= 0 ? `User ${ui + 1}` : String(userAddr);
                                const opLabel = oi >= 0 ? `Operator ${oi + 1}` : String(opAddr);
                                console.log(`${userLabel} CSI report at ${opLabel}`);
                            } catch (_) {
                            }
                        }
                        await transactionViewer.captureTransaction(
                            item.tx,
                            item.desc,
                            item.contract,
                            item.method,
                            item.args
                        );
                    }
                }
            

                // Calculate latest rates and priorities for each operator
                const latestRatesByOp = Array.from({ length: operators.length }, () => new Array(users.length).fill(0));
                const prioritiesByOp = Array.from({ length: operators.length }, () => new Array(users.length).fill(0));

                for (let j = 0; j < operators.length; j++) {
                    const operator = operators[j];
                    for (let i = 0; i < users.length; i++) {
                        const user = users[i];
                        try {
                            const latestRate = await statusReportingContract.getLatestRate(user, operator);
                            const rateNum = Number(latestRate.toString());
                            latestRatesByOp[j][i] = rateNum;
                            const denom = prevThroughputNums[i] > 0 ? prevThroughputNums[i] : 1e-6;
                            prioritiesByOp[j][i] = rateNum / denom;
                        } catch (_) {
                            latestRatesByOp[j][i] = 0;
                            prioritiesByOp[j][i] = 0;
                        }
                    }
                }
                
                // Rate table for each user at each operator in this round (from latest StatusReportingContract reports)
                // try {
                //     console.log(`\n📊 Round ${round} user rates (Kbps):\n`);
                //     let header = `    User    `;
                //     for (let j = 0; j < operators.length; j++) {
                //         header += `  Operator${j + 1}  `;
                //     }
                //     console.log(header);
                //     let sep = `    -----    ` + new Array(operators.length).fill(`-------- `).join(`  `);
                //     console.log(sep);
                //     for (let i = 0; i < users.length; i++) {
                //         const user = users[i];
                //         let row = `    User${i + 1}`.padEnd(8, ' ');
                //         for (let j = 0; j < operators.length; j++) {
                //             try {
                //                 const r = await statusReportingContract.getLatestRate(user, operators[j]);
                //                 row += String(Number(r.toString())).padStart(10, ' ');
                //             } catch (_) {
                //                 row += `      -   `;
                //             }
                //         }
                //         console.log(row);
                //     }
                // } catch (_) {}

                console.log(`\nRound ${round} · Scheduling priority and throughput update calculation:`);

                // Combined table output: User | Previous round throughput | Operator 1 rate | Operator 1 priority | Operator 2 rate | Operator 2 priority | ...
                let header = `    User     Previous throughput    |`;
                for (let j = 0; j < operators.length; j++) {
                    if (j > 0) header += `    |`;
                    header += `    Rate at Operator${j + 1}    Priority at Operator${j + 1}`;
                }
                console.log(`\n📈 User previous round throughput, rates and priorities at each operator (priority = latest rate / previous throughput):\n`);
                console.log(header);
                let sep = `    ------   -------------------    |`;
                for (let j = 0; j < operators.length; j++) {
                    if (j > 0) sep += `    |`;
                    sep += `    -----------------    ---------------------`;
                }
                console.log(sep);
                for (let i = 0; i < users.length; i++) {
                    const label = `User ${i + 1}`.padEnd(15, ' ');
                    const prevTpStr = (prevThroughputNums[i] || 0).toFixed(8).padStart(10, ' ');
                    let row = `    ${label}  ${prevTpStr}     |`;
                    let filler = `    ${' '.repeat(label.length)}  ${' '.repeat(prevTpStr.length)}     |`;
                    for (let j = 0; j < operators.length; j++) {
                        const rateStr = String(latestRatesByOp[j][i] || 0).padStart(14, ' ');
                        const prioStr = (prioritiesByOp[j][i] || 0).toFixed(2).padStart(19, ' ');
                        if (j > 0) { row += `     |`; filler += `     |`; }
                        row += `      ${rateStr}      ${prioStr}`;
                        filler += `      ${' '.repeat(14)}      ${' '.repeat(19)}`;
                    }
                    console.log(row);
                    if (i < users.length - 1) {
                        console.log(filler);
                    }
                }

                console.log(`\n🧭 Scheduling results:\n`);
                // Build matrix header: Operator | User 1 | User 2 | User 3 | User 4
                let headerOp = `    Operator `;
                for (let i = 0; i < users.length; i++) {
                    headerOp += `     User${i + 1}`;
                }
                console.log(headerOp);
                let sepOp = `    ----------`;
                for (let i = 0; i < users.length; i++) {
                    sepOp += `   ------ `;
                }
                console.log(sepOp);
                for (let j = 0; j < operators.length; j++) {
                    const op = operators[j];
                    let row = `    Operator ${j + 1}`;
                    let selectedIdx = -1;
                    try {
                        const sel = await schedulingContract.selectedUser(op);
                        if (sel && sel !== ethers.constants.AddressZero) {
                            selectedIdx = users.findIndex(u => u.toLowerCase() === sel.toLowerCase());
                        }
                    } catch (error) {
                        selectedIdx = -1;
                    }
                    for (let i = 0; i < users.length; i++) {
                        row += (i === selectedIdx) ? `       √  ` : `       -  `;
                    }
                    console.log(row);
                }

                console.log(`\n📊 User throughput (Kbps):\n`);
                const throughputNums = new Array(users.length).fill(0);
                const userDataPromises = users.map(async (user, i) => {
                    const userNum = i + 1;
                    try {
                        const userThroughput = await schedulingContract.throughput(user);
                        // Contract stores throughput with 1e8 precision, format with 8 decimal places
                        const tpStr = ethers.utils.formatUnits(userThroughput, 8);
                        const tpNum = Number(tpStr);
                        throughputNums[i] = tpNum;
                        console.log(`    User ${userNum}: ${tpNum.toFixed(8)}`);
                    } catch (error) {
                        console.log(`    User ${userNum}: Failed to get information - ${error.message}`);
                        throughputNums[i] = 0;
                    }
                });      
                await Promise.all(userDataPromises);
            }

                        
            // Sampling: record current throughput every 100 rounds (optional)
            if (SAVE_DATA) {
                try {
                    if (round % 100 === 0) {
                        const throughputs = [];
                        for (let i = 0; i < users.length; i++) {
                            const tp = await schedulingContract.throughput(users[i]);
                            throughputs.push(Number(tp.toString())); // Keep the integer scaled by 1e8 on-chain, convert when plotting
                        }
                        throughputSamples.push({ round, throughputs });
                    }
                } catch (_) {}
            }
                        
            // Update progress monitoring (every 500 rounds to reduce log output)
            if (round % 500 === 0) {
                progressMonitor.updateProgress(round);
                if (global.gc) {
                    global.gc();
                }
            }
            
        } catch (error) {
            const errorMsg = `Round ${round} scheduling failed: ${error.message}`;
            console.error(`❌ ${errorMsg}`);
            console.error(`❌ Error stack:`, error.stack);
            progressMonitor.error(errorMsg);
            
            // If it's a Hardhat internal error, try to continue running
            if (error.message.includes('panicked') || error.message.includes('task')) {
                console.log(`🔄 Detected Hardhat internal error, trying to continue...`);
                // Wait for a while before continuing
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
            } else {
                break;
            }
        }
    }
    
    console.log(`\n🎉 All ${totalRounds} rounds of scheduling completed`);
    
    // Output throughput for each user (keep 8 decimal places, corresponding to scaling factor 100000000 in contract)
    console.log("\n📈 Final user throughput (Kbps):\n");
    for (let i = 0; i < users.length; i++) {
        const tp = await schedulingContract.throughput(users[i]);        
        const throughputValue = ethers.utils.formatUnits(tp, 8);
        console.log(`  User ${i + 1} (${users[i]}): ${throughputValue}`);
    }

    // Complete progress monitoring
    progressMonitor.complete();

    // Write sampling data to file for plotting (optional)
    if (SAVE_DATA) {
        try {
            const out = {
                totalRounds,
                interval: 100,
                usersCount: 4,
                samples: throughputSamples
            };
            const path = require('path');
            const fsNode = require('fs');
            const outPath = path.join(__dirname, 'reports', 'throughput_results.json');     
            if (!fsNode.existsSync(path.dirname(outPath))) {
                fsNode.mkdirSync(path.dirname(outPath), { recursive: true });
            }
            fsNode.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf-8');
            console.log(`\n💾 Sampling data saved: reports/throughput_results.json`);
        } catch (e) {
            console.log(`⚠️  Failed to save sampling data: ${e.message}`);
        }
    }
}

// If this file is run directly, execute all steps
if (require.main === module) {
    async function runAllSteps() {
        try {            
            // Call initialization script for deployment and configuration
            await getContracts();
            // Register operators and users
            await register();
            // Pause and wait for user confirmation before starting multi-round user scheduling
            await waitForAnyKey("\nPress any key to continue running multi-round user scheduling...\n");
            
            // Multi-round scheduling loop
            await runSchedulingRounds();            
            
            console.log("\n🎊 All steps completed! Multi-round scheduling system finished running!");
        
            
        } catch (error) {
            console.error("❌ Error:", error.message);
        }
    }
    
    runAllSteps();
}