const hre = require("hardhat");

async function main() {
  console.log("Deploying MedicineTracker...");
  
  const MedicineTracker = await hre.ethers.getContractFactory("MedicineTracker");
  const contract = await MedicineTracker.deploy();
  await contract.waitForDeployment();
  
  console.log("Contract Address:", await contract.getAddress());
}

main().catch(console.error);