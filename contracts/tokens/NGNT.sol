// SPDX-License-Identifier:MIT
pragma solidity 0.7.6;

import './ERC20.sol';

contract NGNTContract is ERC20("Naira Token", "NGNT"){
  uint256 public gsnFee;
  constructor() {
    _mint(msg.sender, 1e18);
  }
}