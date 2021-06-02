/* global artifacts before it assert contract xit */
const {
  constants: { MAX_UINT256 },
  expectRevert,
  expectEvent,
  BN,
} = require("@openzeppelin/test-helpers");
// const { GsnTestEnvironment } = require("@opengsn/dev");
// const { RelayProvider } = require("@opengsn/provider");
// const Web3 = require("web3");

const winNgntContract = artifacts.require("WinNgnt");
const ngntContract = artifacts.require("NGNT");

// const paymasterAddress = process.env.ACCEPT_EVERYTHING_PAYMASTER;
const ngntBscTestnetAddress = process.env.NGNT;
// const Paymaster = artifacts.require("AcceptEverythingPaymaster");

// const { paymasterAddress, forwarderAddress } = GsnTestEnvironment.loadDeployments();
// const paymasterAddress = "0x7EfE0180D6A4df94388D9023d39f3675f44eA915";
// const forwarderAddress = "0x04Bd619598C2D5eA209C40DB00376D9AF5CB8C3d";
// const relayHub = "0x6656b70469Fb1c0779719d0aB3065a41e0fcc04B";

contract("WinNgnt", async (accounts) => {
  let winNgntInstance;
  let ngntInstance;
  const ticketPrice = 50000;
  const [Buyer] = accounts;

  before(async () => {
    winNgntInstance = await winNgntContract.deployed();
    ngntInstance = await ngntContract.at(ngntBscTestnetAddress);
    await ngntInstance.approve(winNgntInstance.address, MAX_UINT256);
  });

  xit("should let buyer buy a single ticket", async () => {
    await winNgntInstance.buyTicket(1);
    const ticketsBought = await winNgntInstance.numberOfTicketsPurchased();
    assert.equal(ticketsBought, 1, `${ticketsBought} tickets were bought`);
  });

  xit("should not let anyone buy less than one ticket", async () => {
    await expectRevert.unspecified(winNgntInstance.buyTicket(0));
  });

  xit("should not let anyone buy more tickets than address max", async () => {
    const maxTickets = await winNgntInstance.maximumTicketsPerAddress();
    await expectRevert.unspecified(winNgntInstance.buyTicket(maxTickets));
  });

  xit("should not let anyone buy more tickets than game max", async () => {
    const maxTickets = await winNgntInstance.maximumPurchasableTickets();
    await expectRevert.unspecified(
      winNgntInstance.buyTicket(maxTickets.toNumber() + 1)
    );
  });

  it("should deduct price of tickets bought", async () => {
    const ngntBalBeforeBuy = await ngntInstance.balanceOf(Buyer);
    const noOfTicketsBought = 4;
    await winNgntInstance.buyTicket(noOfTicketsBought);
    const ngntBalAfterBuy = await ngntInstance.balanceOf(Buyer);
    const balDiff = ngntBalBeforeBuy.sub(ngntBalAfterBuy);
    console.log(
      ngntBalBeforeBuy.toString(),
      ngntBalAfterBuy.toString(),
      balDiff.toString(),
    );
    assert.equal(
      balDiff,
      ticketPrice * noOfTicketsBought,
      `${balDiff} is not equal to ${ticketPrice}`,
    );
  });

  xit("should set the Forwarder", async () => {
    const forwarder = "0x4Edfb2663b3F0DC627fd45C61d8a037848B6f86f";
    await winNgntInstance.setForwarder(forwarder);
    const trustedForwarder = await winNgntInstance.trustedForwarder();
    assert.equal(forwarder, trustedForwarder, "trusted forwarder not set");
  });

  xit("should emit buy event", async () => {
    const numOfTicketsBought = 4;
    const ticketsPrice = numOfTicketsBought * ticketPrice;
    const receipt = await winNgntInstance.buyTicket(numOfTicketsBought);
    expectEvent(receipt, "BoughtTicket", {
      buyer: Buyer,
      numOfTickets: new BN(numOfTicketsBought),
      totalTicketPrice: new BN(ticketsPrice),
    });
  });
});

// contract("WinNgnt with GSN", async (accounts) => {
//   const [Alice] = accounts;
//   before(async () => {
//     // const paymaster = await Paymaster.deployed();
//     // paymaster.setRelayHub(relayHub);
//     // const paymasterAddress = paymaster.address;
//     // await web3.eth.sendTransaction({
//     //  from: Alice, to: paymasterAddress, value: "1000000000000000000" });

//     const config = {
//       paymasterAddress,
//       loggerConfiguration: {
//         logLevel: "debug",
//       },
//     };

//     const provider = await RelayProvider.newProvider({
//       provider: web3.currentProvider,
//       config,
//     }).init();
//     const relayProvider = new Web3(provider);

//     WinNgnt.setProvider(relayProvider);
//     winNgnt = await WinNgnt.deployed();
//     winNgnt.setForwarder(forwarderAddress);

//     Ngnt.setProvider(relayProvider);
//     ngnt = await Ngnt.deployed();
//     await ngnt.approve(winNgnt.address, MAX_UINT256);
//   });

//   it("should buy a ticket with zero gas", async () => {
//     await winNgnt.numberOfTicketsPurchased.call();
//     // const ticketsBought = await winNgnt.numberOfTicketsPurchased();
//     // assert.equal(ticketsBought, 1, `${ticketsBought} tickets were bought`);
//   });
// });
