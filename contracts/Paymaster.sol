//SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@opengsn/contracts/src/BasePaymaster.sol";

// accept everything.
// this paymaster accepts any request.
//
// NOTE: Do NOT use this contract on a mainnet: it accepts anything, so anyone can "grief" it and drain its account

contract WinNgntPaymaster is BasePaymaster {
    
    address private target;
    
    function changeTarget(address _newTarget) external onlyOwner{
        target = _newTarget;
    }

    function versionPaymaster() external view override virtual returns (string memory){
        return "2.2.0+opengsn.accepteverything.ipaymaster";
    }

    function preRelayedCall(
        GsnTypes.RelayRequest calldata relayRequest,
        bytes calldata signature,
        bytes calldata approvalData,
        uint256 maxPossibleGas
    )
    external
    override
    virtual
    returns (bytes memory context, bool revertOnRecipientRevert) {
        (signature, approvalData, maxPossibleGas);
        require(relayRequest.request.to == target, "WinNgntPaymaster: Target is not WinNgnt Contract");
        return ("", false);
    }

    function postRelayedCall(
        bytes calldata context,
        bool success,
        uint256 gasUseWithoutPost,
        GsnTypes.RelayData calldata relayData
    ) external override virtual {
        (context, success, gasUseWithoutPost, relayData);
    }
}