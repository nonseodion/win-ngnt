/* global artifacts */
const WinNgnt = artifacts.require("WinNgnt");
const Ngnt = artifacts.require("NGNT");
const maximumPurchasableTicket = process.env.MAXIMUM_PURCHASABLE_TICKET;
const pegswap = process.env.PEGSWAP;
const ngnt = process.env.NGNT;
const pancakeRouter = process.env.PANCAKE_ROUTER;
const linkErc20 = process.env.LINK_ERC20;
// const paymaster = process.env.ACCEPT_EVERYTHING_PAYMASTER;
const wbnb = process.env.WBNB;

module.exports = async (deployer, network) => {
  if (network === "bscTestnet") {
    await deployer.deploy(
      WinNgnt,
      ngnt,
      maximumPurchasableTicket,
      pegswap,
      linkErc20,
      wbnb,
      pancakeRouter,
    );
  } //else if (network === "development") {
  //   await deployer.deploy(Ngnt);
  //   await deployer.deploy(
  //     WinNgnt,
  //     Ngnt.address,
  //     maximumPurchasableTicket,
  //     pegswap,
  //     linkErc20,
  //     wbnb,
  //     pancakeRouter,
  //   );
  // }
};
