// bcpfs-init.js - BC-PFS Platform Initialization
const { ethers } = require("hardhat");
const TransactionViewer = require('./transaction-viewer');



async function initPlatform() {
  // Global variables to store contract instances
  let registrationContract;
  let statusReportingContract;
  let schedulingContract;
  let settlementContract;

  // Transaction result viewer
  let transactionViewer;

  console.log("\nPlatform initialization started...\n");
  console.log("🚀 Step 1: Deploy contracts");
  console.log("===========================");

  // Initialize transaction viewer
  transactionViewer = new TransactionViewer();

  // Enable automatic mining for fast deployment
  await ethers.provider.send("evm_setAutomine", [true]);

  const RegistrationContract = await ethers.getContractFactory("RegistrationContract");
  const regTx = await RegistrationContract.deploy();
  registrationContract = await RegistrationContract.attach(regTx.address);
  console.log("✅ Registration contract deployed successfully");
  await transactionViewer.captureTransaction(
      regTx, 
      "Deploy registration contract", 
      registrationContract, 
      "constructor"
  );
  console.log();

  const StatusReportingContract = await ethers.getContractFactory("StatusReportingContract");
  const statusTx = await StatusReportingContract.deploy();
  statusReportingContract = await StatusReportingContract.attach(statusTx.address);
  console.log("✅ Status reporting contract deployed successfully");
  await transactionViewer.captureTransaction(
      statusTx, 
      "Deploy status reporting contract", 
      statusReportingContract, 
      "constructor"
  );
  console.log();

  const SchedulingContract = await ethers.getContractFactory("SchedulingContract");
  const schedulingTx = await SchedulingContract.deploy();
  schedulingContract = await SchedulingContract.attach(schedulingTx.address);
  console.log("✅ Scheduling contract deployed successfully");
  await transactionViewer.captureTransaction(
      schedulingTx, 
      "Deploy scheduling contract", 
      schedulingContract, 
      "constructor"
  );
  console.log();

  const SettlementContract = await ethers.getContractFactory("SettlementContract");
  const settlementTx = await SettlementContract.deploy();
  settlementContract = await SettlementContract.attach(settlementTx.address);
  console.log("✅ Settlement contract deployed successfully");
  await transactionViewer.captureTransaction(
      settlementTx, 
      "Deploy settlement contract", 
      settlementContract, 
      "constructor"
  );
  console.log();

  console.log("🎉 Contract deployment completed!\n");

  console.log("\n🔗 Step 2: Configure contract relationships");
  console.log("=========================================");


  const tx1 = await schedulingContract.setStatusReportingContract(statusReportingContract.address);
  console.log("✅ Scheduling contract connected to status reporting contract");
  await transactionViewer.captureTransaction(
      tx1, 
      "Connect scheduling contract to status reporting contract", 
      schedulingContract, 
      "setStatusReportingContract", 
      [statusReportingContract.address]
  );

  const tx2 = await schedulingContract.setRegistrationContract(registrationContract.address);
  console.log("✅ Scheduling contract connected to registration contract");
  await transactionViewer.captureTransaction(
      tx2, 
      "Connect scheduling contract to registration contract", 
      schedulingContract, 
      "setRegistrationContract", 
      [registrationContract.address]
  );

  const tx3 = await settlementContract.setSchedulingContract(schedulingContract.address);
  console.log("✅ Settlement contract connected to scheduling contract");
  await transactionViewer.captureTransaction(
      tx3, 
      "Connect settlement contract to scheduling contract", 
      settlementContract, 
      "setSchedulingContract", 
      [schedulingContract.address]
  );

  const tx4 = await settlementContract.setRegistrationContract(registrationContract.address);
  console.log("✅ Settlement contract connected to registration contract");
  await transactionViewer.captureTransaction(
      tx4, 
      "Connect settlement contract to registration contract", 
      settlementContract, 
      "setRegistrationContract", 
      [registrationContract.address]
  );

  console.log("🎉 Contract relationship configuration completed!\n");
  console.log("🎉 Platform initialization completed!\n");

  // Return contract instances
  return {
    registrationContract,
    statusReportingContract,
    schedulingContract,
    settlementContract
  };
}

// When run directly as a script, also supports standalone deployment
if (require.main === module) {
  initPlatform().then(() => {
  }).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { initPlatform };
