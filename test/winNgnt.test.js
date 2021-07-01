/* global artifacts before it assert contract it */
const {
  constants: { MAX_UINT256 },
  expectRevert,
  expectEvent,
  BN,
} = require("@openzeppelin/test-helpers");

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
    relayHub
  },
  maximumPurchasableTickets,
} = require("../params.json");

const { RelayProvider } = require("@opengsn/provider");
// const Web3 = require("web3");

const winNgntContract = artifacts.require("WinNgnt");
const ngntContract = artifacts.require("NGNT");
const paymasterContract = artifacts.require("WinNgntPaymaster");

contract("WinNgnt without GSN", async () => {
  let winNgntInstance;
  let ngntInstance;
  const buyer = "0xef7d1352c49a1DE2E0cea1CAa644032238e0f5AF";

  before(async () => {
    ngntInstance = await ngntContract.at(ngnt);
    winNgntInstance = await winNgntContract.new(
      ngnt,
      pegswap,
      LINK_ERC20,
      wbnb,
      pancakeRouter,
      vrfCoordinator,
      LINK_ERC677,
      trustedForwarder,
      maximumPurchasableTickets,
    );
    await ngntInstance.approve(winNgntInstance.address, MAX_UINT256, {
      from: buyer,
    });
  });

  it("should let buyer buy a single ticket", async () => {
    await winNgntInstance.buyTicket(1, { from: buyer });
    const ticketsBought = await winNgntInstance.numberOfTicketsPurchased();
    assert.equal(ticketsBought, 1, `${ticketsBought} tickets were bought`);
  });

  it("should not let anyone buy less than one ticket", async () => {
    await expectRevert.unspecified(winNgntInstance.buyTicket(0));
  });

  it("should not let anyone buy more tickets than address max", async () => {
    const maxTickets = await winNgntInstance.maximumTicketsPerAddress();
    await expectRevert.unspecified(winNgntInstance.buyTicket(maxTickets));
  });

  it("should not let anyone buy more tickets than game max", async () => {
    const maxTickets = await winNgntInstance.maximumPurchasableTickets();
    await expectRevert.unspecified(
      winNgntInstance.buyTicket(maxTickets.toNumber() + 1)
    );
  });

  it("should deduct price of tickets bought", async () => {
    const ngntBalBeforeBuy = await ngntInstance.balanceOf(buyer);
    const ticketPrice = await winNgntInstance.ticketPrice();
    const noOfTicketsBought = new BN(4);
    await winNgntInstance.buyTicket(noOfTicketsBought, { from: buyer });
    const ngntBalAfterBuy = await ngntInstance.balanceOf(buyer);
    const balDiff = ngntBalBeforeBuy.sub(ngntBalAfterBuy);
    assert.equal(
      balDiff.toString(),
      ticketPrice.mul(noOfTicketsBought).toString(),
      "buyer balance not reduced appropriately"
    );
  });

  it("should emit buy event", async () => {
    const numOfTicketsBought = new BN("4");
    const ticketPrice = await winNgntInstance.ticketPrice();
    const ticketsPrice = numOfTicketsBought.mul(ticketPrice).sub(numOfTicketsBought.mul( new BN("5000")));
    const receipt = await winNgntInstance.buyTicket(numOfTicketsBought, {
      from: buyer,
    });
    expectEvent(receipt, "BoughtTicket", {
      buyer,
      numOfTickets: new BN(numOfTicketsBought),
      totalTicketPrice: new BN(ticketsPrice),
    });
  });

  context("when all the tickets are bought", async () => {
    let receipt;

    before(async () => {
      const ticketsPurchased = await winNgntInstance.numberOfTicketsPurchased();
      const remainingTickets = (new BN(maximumPurchasableTickets-1)).sub(ticketsPurchased)
      await winNgntInstance.buyTicket(remainingTickets, {
        from: buyer,
      });

      receipt = await winNgntInstance.buyTicket(new BN("1"), {
        from: buyer,
      });
    });


    it("should emit gameEnded event", async () => {
      expectEvent(receipt, "GameEnded", {gameNumber: new BN("1")})
    })

    it("should emit RandomNumberQuerySent event", async() => {
      expectEvent(receipt, "RandomNumberQuerySent", {gameNumber: new BN("1")})
    })
  })
});

contract("WinNgnt with GSN", async (accounts) => {
  const [Alice] = accounts;
  
  before(async () => {
    const paymasterInstance = await Paymaster.deployed();
    paymasterInstance.setRelayHub(relayHub);
    paymasterAddress = paymasterInstance.address

    const config = {
      paymasterAddress,
      loggerConfiguration: {
        logLevel: "debug",
      },
    };

    const provider = await RelayProvider.newProvider({
      provider: web3.currentProvider,
      config,
    }).init();
    const relayProvider = new Web3(provider);
    console.log(relayProvider, provider)

    // WinNgnt.setProvider(relayProvider);
    // winNgnt = await WinNgnt.deployed();
    // winNgnt.setForwarder(forwarderAddress);

    // Ngnt.setProvider(relayProvider);
    // ngnt = await Ngnt.deployed();
    // await ngnt.approve(winNgnt.address, MAX_UINT256);
  });

  // it("should buy a ticket with zero gas", async () => {
  //   await winNgnt.numberOfTicketsPurchased.call();
  //   // const ticketsBought = await winNgnt.numberOfTicketsPurchased();
  //   // assert.equal(ticketsBought, 1, `${ticketsBought} tickets were bought`);
  // });
});
