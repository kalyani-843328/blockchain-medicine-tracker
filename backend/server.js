const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const CONTRACT_ADDRESS = "0xdE69D1b209B477917110510838F72cB1C1e7dFfA";
const CONTRACT_ABI = [
  "function addMedicine(string memory _name, string memory _batchNumber, uint256 _expiryDate) public returns (uint256)",
  "function verifyMedicine(uint256 _id) public view returns (bool isAuthentic, string memory message)",
  "function addManufacturer(address _manufacturer) public",
  "function authorizedManufacturers(address) public view returns (bool)",
  "function medicineCount() public view returns (uint256)"
];

let provider, wallet, contract;

try {
  provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_URL);
  wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
  console.log("Blockchain connected! ✅");
} catch(e) {
  console.error("Blockchain connection error:", e.message);
}

app.get('/api/verify/:id', async (req, res) => {
  try {
    console.log("Verifying medicine ID:", req.params.id);
    const [isAuthentic, message] = await contract.verifyMedicine(req.params.id);
    res.json({ isAuthentic, message });
  } catch (error) {
    console.error("Verify error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/medicine/add', async (req, res) => {
  try {
    const { name, batchNumber, expiryDate } = req.body;
    console.log("Adding medicine:", name, batchNumber, expiryDate);
    
    const tx = await contract.addMedicine(name, batchNumber, expiryDate);
    console.log("Transaction sent:", tx.hash);
    await tx.wait();
    console.log("Transaction confirmed!");
    
    const id = await contract.medicineCount();
    const qrCode = await QRCode.toDataURL(`Medicine ID: ${id}`);
    
    res.json({ success: true, medicineId: id.toString(), qrCode });
  } catch (error) {
    console.error("Add medicine error:", error.message);
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/medicines/all', async (req, res) => {
  try {
    const count = await contract.medicineCount();
    const medicines = [];
    for (let i = 1; i <= count; i++) {
      const [isAuthentic, message] = await contract.verifyMedicine(i);
      medicines.push({
        medicineId: i.toString(),
        name: message,
        isAuthentic
      });
    }
    res.json({ success: true, medicines, total: medicines.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.listen(3001, () => {
  console.log('Server running on port 3001 ✅');
});