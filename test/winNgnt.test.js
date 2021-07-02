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
    relayHub,
  },
  maximumPurchasableTickets,
} = require("../params.json");

const { RelayProvider } = require("@opengsn/provider");
const Web3 = require("web3");

const winNgntContract = artifacts.require("WinNgnt");
const ngntContract = artifacts.require("NGNT");
const paymasterContract = artifacts.require("WinNgntPaymaster");
const relayHubContract = artifacts.require("IRelayHub");

contract("WinNgnt", async (accounts) => {
  let winNgntInstance;
  let ngntInstance;
  const buyer = "0xef7d1352c49a1DE2E0cea1CAa644032238e0f5AF";
  const contractOptions = { gasPrice: 20000000000, gas: 6721975 }

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
      maximumPurchasableTickets
    );
    await ngntInstance.approve(winNgntInstance.address, MAX_UINT256, {
      from: buyer,
    });
  });

  // context("Without GSN", async() => {
  //   it("should let buyer buy a single ticket", async () => {
  //     await winNgntInstance.buyTicket(1, { from: buyer });
  //     const ticketsBought = await winNgntInstance.numberOfTicketsPurchased();
  //     assert.equal(ticketsBought, 1, `${ticketsBought} tickets were bought`);
  //   });

  //   it("should not let anyone buy less than one ticket", async () => {
  //     await expectRevert.unspecified(winNgntInstance.buyTicket(0));
  //   });

  //   it("should not let anyone buy more tickets than address max", async () => {
  //     const maxTickets = await winNgntInstance.maximumTicketsPerAddress();
  //     await expectRevert.unspecified(winNgntInstance.buyTicket(maxTickets));
  //   });

  //   it("should not let anyone buy more tickets than game max", async () => {
  //     const maxTickets = await winNgntInstance.maximumPurchasableTickets();
  //     await expectRevert.unspecified(
  //       winNgntInstance.buyTicket(maxTickets.toNumber() + 1)
  //     );
  //   });

  //   it("should deduct price of tickets bought", async () => {
  //     const ngntBalBeforeBuy = await ngntInstance.balanceOf(buyer);
  //     const ticketPrice = await winNgntInstance.ticketPrice();
  //     const noOfTicketsBought = new BN(4);
  //     await winNgntInstance.buyTicket(noOfTicketsBought, { from: buyer });
  //     const ngntBalAfterBuy = await ngntInstance.balanceOf(buyer);
  //     const balDiff = ngntBalBeforeBuy.sub(ngntBalAfterBuy);
  //     assert.equal(
  //       balDiff.toString(),
  //       ticketPrice.mul(noOfTicketsBought).toString(),
  //       "buyer balance not reduced appropriately"
  //     );
  //   });

  //   it("should emit buy event", async () => {
  //     const numOfTicketsBought = new BN("4");
  //     const ticketPrice = await winNgntInstance.ticketPrice();
  //     const ticketsPrice = numOfTicketsBought.mul(ticketPrice).sub(numOfTicketsBought.mul( new BN("5000")));
  //     const receipt = await winNgntInstance.buyTicket(numOfTicketsBought, {
  //       from: buyer,
  //     });
  //     expectEvent(receipt, "BoughtTicket", {
  //       buyer,
  //       numOfTickets: new BN(numOfTicketsBought),
  //       totalTicketPrice: new BN(ticketsPrice),
  //     });
  //   });

  //   context("when all the tickets are bought", async () => {
  //     let receipt;

  //     before(async () => {
  //       const ticketsPurchased = await winNgntInstance.numberOfTicketsPurchased();
  //       const remainingTickets = (new BN(maximumPurchasableTickets-1)).sub(ticketsPurchased)
  //       await winNgntInstance.buyTicket(remainingTickets, {
  //         from: buyer,
  //       });

  //       receipt = await winNgntInstance.buyTicket(new BN("1"), {
  //         from: buyer,
  //       });
  //     });

  //     it("should emit gameEnded event", async () => {
  //       expectEvent(receipt, "GameEnded", {gameNumber: new BN("1")})
  //     })

  //     it("should emit RandomNumberQuerySent event", async() => {
  //       expectEvent(receipt, "RandomNumberQuerySent", {gameNumber: new BN("1")})
  //     })
  //   })
  // })

  context("With GSN", async () => {
    const [Alice] = accounts;
    before(async () => {
      const paymasterInstance = await paymasterContract.new();
      await paymasterInstance.setRelayHub(relayHub);
      paymasterAddress = paymasterInstance.address;

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
      web3 = new Web3(provider);
      winNgntInstance = await winNgntContract.new(
        ngnt,
        pegswap,
        LINK_ERC20,
        wbnb,
        pancakeRouter,
        vrfCoordinator,
        LINK_ERC677,
        trustedForwarder,
        maximumPurchasableTickets
      );

      const relayHubInstance = new web3.eth.Contract(
        relayHubContract.abi,
        relayHub
      );
      await relayHubInstance.methods
        .depositFor(paymasterAddress)
        .send({ from: Alice, value: web3.utils.toWei("2"), useGSN: false });
      
      await ngntInstance.approve(winNgntInstance.address, MAX_UINT256, {
          from: Alice,
        });

      await ngntInstance.transfer(Alice, 1000000, {
          from: buyer,
        });

      winNgntInstance = new web3.eth.Contract(
        winNgntContract.abi,
        winNgntInstance.address
      );
    });

    console.log(Alice)
    it("should buy a ticket with zero gas", async () => {
      await winNgntInstance.methods.buyTicket(1).send({ from: Alice, });
      const ticketsBought = await winNgntInstance.methods
        .numberOfTicketsPurchased()
        .call();
      assert.equal(
        ticketsBought.toString(),
        1,
        `${ticketsBought} tickets were bought`
      );
    });

    
  });
});
