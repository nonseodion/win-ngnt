/* global artifacts */
const WinNgnt = artifacts.require("WinNgnt");
const Ngnt = artifacts.require("NGNT");
const {
  bsc: {
    ngnt,
    pegswap,
    LINK_ERC20,
    wbnb,
    pancakeRouter,
    vrfCoordinator,
    LINK_ERC677,
    trustedForwarder,
    paymaster,
    relayHub,
    chainLinkFee,
    maximumPurchasableTickets,
  }
} = require("./utils/params.json");
// const paymaster = process.env.ACCEPT_EVERYTHING_PAYMASTER;

module.exports = async (deployer, network) => {
  if (network === "bsc") {
    await deployer.deploy(
      WinNgnt,
      ngnt,
      pegswap,
      LINK_ERC20,
      wbnb,
      pancakeRouter,
      relayHub,
      vrfCoordinator,
      LINK_ERC677,
      trustedForwarder,
      paymaster,
      chainLinkFee,
      maximumPurchasableTickets
    );
  }
};
