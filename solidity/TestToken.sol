// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ERC20 token used for unit testing
contract TestToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("TestToken", "TT") {
        _mint(msg.sender, initialSupply);
    }
}
