const { ethers } = require('ethers');
require('dotenv').config();

const CONTRACT_ADDRESS = "0xdE69D1b209B477917110510838F72cB1C1e7dFfA";
const ABI = [
  "function addManufacturer(address _manufacturer) public"
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
  
  const tx = await contract.addManufacturer(wallet.address);
  await tx.wait();
  
  console.log("Manufacturer added! ✅", wallet.address);
}

main().catch(console.error);