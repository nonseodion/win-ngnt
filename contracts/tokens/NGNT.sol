// SPDX-License-Identifier:MIT
pragma solidity 0.7.6;

import './ERC20.sol';

contract NGNT is ERC20("Naira Token", "NGNT"){
  constructor() {
    _mint(msg.sender, 1e18);
  }
}