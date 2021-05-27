// SPDX-License-Identifier:MIT
pragma solidity ^0.6.0;
interface IPegswap{
  /**
   * @notice exchanges the source token for target token
   * @param amount count of tokens being swapped
   * @param source the token that is being given
   * @param target the token that is being taken
   */
  function swap(
    uint256 amount,
    address source,
    address target
  )
    external;
}