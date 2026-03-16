// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MedicineTracker {

    struct Medicine {
        uint256 id;
        string name;
        string batchNumber;
        address manufacturer;
        uint256 expiryDate;
        bool isAuthentic;
    }

    mapping(uint256 => Medicine) public medicines;
    mapping(address => bool) public authorizedManufacturers;
    uint256 public medicineCount = 0;
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function addManufacturer(address _manufacturer) public {
        require(msg.sender == owner, "Only owner");
        authorizedManufacturers[_manufacturer] = true;
    }

    function addMedicine(
        string memory _name,
        string memory _batchNumber,
        uint256 _expiryDate
    ) public returns (uint256) {
        require(authorizedManufacturers[msg.sender], "Not authorized");
        medicineCount++;
        medicines[medicineCount] = Medicine(
            medicineCount, _name, _batchNumber,
            msg.sender, _expiryDate, true
        );
        return medicineCount;
    }

    function verifyMedicine(uint256 _id)
        public view returns (bool, string memory) {
        Medicine memory med = medicines[_id];
        if (med.id == 0) return (false, "FAKE - Not found!");
        if (block.timestamp > med.expiryDate) return (false, "Expired!");
        return (true, "AUTHENTIC!");
    }
}