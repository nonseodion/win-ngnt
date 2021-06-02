// SPDX-License-Identifier:MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract LINK is ERC20("LINK Token", "LINK"){
  constructor(){
    _mint(msg.sender, 1e18);
  }
}