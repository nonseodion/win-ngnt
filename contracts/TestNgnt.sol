// SPDX-License-Identifier:MIT
pragma solidity ^0.6.0;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract NGNT is ERC20("Naira Token", "NGNT"){
  constructor() public{
    _mint(msg.sender, 1e7);
  }
}