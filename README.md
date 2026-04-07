# 💊 MediChain — Blockchain Medicine Tracker

A decentralized pharmaceutical supply chain management system built on Ethereum Blockchain to prevent counterfeit medicines and ensure complete supply chain transparency.

---

## 🌐 Live Demo

🚀 **[MediChain Live →](https://blockchain-medicine-tracker-taupe.vercel.app)**

---

## 📌 About The Project

Counterfeit medicines kill thousands of people every year. **MediChain** uses Ethereum Blockchain + Smart Contracts to:

- 🔗 Register every medicine batch on an immutable blockchain ledger
- 🚚 Track medicine journey: Manufacturer → Distributor → Pharmacy → Patient
- 🔍 Allow instant verification via Medicine ID or QR Code scan
- 🛡️ Prevent fake/duplicate medicines in the supply chain
- 📊 Provide regulatory authorities a real-time monitoring dashboard

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔗 Blockchain Registry | Every medicine registered on Ethereum Sepolia |
| 📷 QR Code Scanner | Camera-based instant medicine verification |
| 🚚 Supply Chain Tracking | 5-step journey tracking with real-time updates |
| 🗺️ Route Visualization | Visual map showing medicine journey |
| 👑 Admin Dashboard | Regulatory monitoring with suspicious activity alerts |
| 🔐 Multi-Role Auth | 5 roles: Admin, Manufacturer, Distributor, Pharmacy, Patient |
| 📱 Responsive Design | Works on mobile and desktop |
| 🔴 Live on Testnet | Deployed on Ethereum Sepolia Testnet |

## 👥 User RolesStar** on GitHub!

---
👑 Admin          → Monitor all medicines, users & supply chain
🏭 Manufacturer   → Register medicines on blockchain
🚚 Distributor    → Mark medicines "In Transit"
💊 Pharmacy       → Mark medicines "Delivered"
🏥 Patient        → Verify medicine authenticity + view supply history

---

## 🛠️ Tech Stack

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Solidity](https://img.shields.io/badge/Solidity-363636?style=for-the-badge&logo=solidity&logoColor=white)
![Ethereum](https://img.shields.io/badge/Ethereum-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

---
- Ethereum Sepolia Testnet
- React + Vite
- Node.js + Express
- Firebase Auth + Firestore
- Railway (Backend)
- Vercel (Frontend)

- 
## 📂 Project Structure
 blockchain-medicine-tracker/
├── frontend/                  # React + Vite Frontend
│   ├── src/
│   │   ├── App.jsx            # Main App Component
│   │   ├── firebase.js        # Firebase Config
│   │   └── main.jsx
│   └── package.json
├── blockchain/                # Smart Contract
│   ├── contracts/
│   │   └── Medicine.sol       # Solidity Smart Contract
│   ├── scripts/
│   │   └── deploy.cjs         # Deployment Script
│   └── hardhat.config.cjs
├── index.js                   # Node.js Backend
└── package.json

---

## ⚙️ How To Run Locally
```bash
# 1. Clone the repository
git clone https://github.com/kalyani-843328/blockchain-medicine-tracker.git

# 2. Go into the folder
cd blockchain-medicine-tracker

# 3. Install backend dependencies
npm install

# 4. Start backend server
npm start

# 5. Open new terminal — go to frontend
cd frontend
npm install
npm run dev
```

> ⚠️ Make sure to add your `.env` file with Firebase & Blockchain credentials

---

## 🔗 Smart Contract

- **Network:** Ethereum Sepolia Testnet
- **Contract Address:** `0xdE69D1b209B477917110510838F72cB1C1e7dFfA`
- **Verified on:** [Sepolia Etherscan](https://sepolia.etherscan.io/address/0xdE69D1b209B477917110510838F72cB1C1e7dFfA)

---

## 🚀 Deployment

| Service | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Railway |
| Blockchain | Ethereum Sepolia |
| Database/Auth | Firebase |

---

## 📸 Screenshots

> 🔜 Coming soon — add your app screenshots here!

---

## 🙋‍♀️ Author

### Kalyani Singh
*Full Stack Blockchain Developer*

[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/kalyani-843328)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/kalyani-singh-330707277)

---

## ⭐ Show Your Support

If you like this project, please give it a ⭐ on GitHub!

---

*Built with ❤️ using Solidity · React · Node.js · Firebase*
