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
  [Alice] = accounts;
  let winNgntInstance;
  let ngntInstance;
  const buyer = "0xef7d1352c49a1DE2E0cea1CAa644032238e0f5AF";
  const contractOptions = { gasPrice: 20000000000, gas: 6721975 };

  before(async () => {
    ngntInstance = await ngntContract.at(ngnt);
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
      relayHub,
      contractOptions
    );
    await relayHubInstance.methods
      .depositFor(paymasterAddress)
      .send({ from: Alice, value: web3.utils.toWei("2"), useGSN: false });

    await ngntInstance.approve(winNgntInstance.address, MAX_UINT256, {
      from: buyer,
    });

    winNgntInstance = new web3.eth.Contract(
      winNgntContract.abi,
      winNgntInstance.address,
      contractOptions
    );
  });

  context("Without GSN", async () => {
    it("should buy a single ticket", async () => {
      await winNgntInstance.methods
        .buyTicket(1)
        .send({ from: buyer, useGSN: false });
      const ticketsBought = await winNgntInstance.methods
        .numberOfTicketsPurchased()
        .call();
      assert.equal(
        ticketsBought.toString(),
        1,
        `${ticketsBought} tickets were bought`
      );
    });

    it("should not let anyone buy less than one ticket", async () => {
      await expectRevert.unspecified(
        winNgntInstance.methods
          .buyTicket(0)
          .send({ from: buyer, useGSN: false })
      );
    });

    it("should not let anyone buy more tickets than address max", async () => {
      const maxTickets = await winNgntInstance.methods
        .maximumTicketsPerAddress()
        .call();
      await expectRevert.unspecified(
        winNgntInstance.methods
          .buyTicket(new BN(maxTickets).add(new BN("1")))
          .send({ from: buyer, useGSN: false })
      );
    });

    it("should not let anyone buy more tickets than game max", async () => {
      const maxTickets = await winNgntInstance.methods
        .maximumPurchasableTickets()
        .call();
      await expectRevert.unspecified(
        winNgntInstance.methods
          .buyTicket(new BN(maxTickets).add(new BN("1")))
          .send({ from: buyer, useGSN: false })
      );
    });

    it("should deduct price of tickets bought", async () => {
      const ngntBalBeforeBuy = await ngntInstance.balanceOf(buyer);
      const ticketPrice = await winNgntInstance.methods.ticketPrice().call();
      const noOfTicketsBought = new BN(4);

      await winNgntInstance.methods
        .buyTicket(noOfTicketsBought)
        .send({ from: buyer, useGSN: false });

      const ngntBalAfterBuy = await ngntInstance.balanceOf(buyer);
      const balDiff = (new BN(ngntBalBeforeBuy)).sub(new BN(ngntBalAfterBuy));

      assert.equal(
        balDiff.toString(),
        (new BN(ticketPrice)).mul(noOfTicketsBought).toString(),
        "buyer balance not reduced appropriately"
      );
    });

    it("should emit buy event", async () => {
      const numOfTicketsBought = new BN("4");
      const ticketPrice = await winNgntInstance.methods.ticketPrice().call();
      const ticketsPrice = numOfTicketsBought
        .mul(new BN(ticketPrice))
        .sub(numOfTicketsBought.mul(new BN("5000")));
      const receipt = await winNgntInstance.methods
        .buyTicket(numOfTicketsBought)
        .send({ from: buyer, useGSN: false });
      expectEvent(receipt, "BoughtTicket", {
        buyer,
        numOfTickets: new BN(numOfTicketsBought),
        totalTicketPrice: new BN(ticketsPrice),
      });
    });

    context("when all the tickets are bought", async () => {
      let receipt;

      before(async () => {
        const ticketsPurchased = await winNgntInstance.methods.numberOfTicketsPurchased().call();
        let remainingTickets = (new BN(maximumPurchasableTickets)).sub(new BN(ticketsPurchased))

        for(i = 0; i < 25 ; i++){
          ngntInstance.transfer(accounts[i], new BN("500000"), {from: buyer});

          ticketsToBuy = parseInt(remainingTickets) > 10 ? 10 : remainingTickets;

          await ngntInstance.approve(winNgntInstance.options.address, MAX_UINT256, {
            from: accounts[i],
          });

          receipt = await winNgntInstance.methods.buyTicket(ticketsToBuy).send({from: accounts[i], useGSN: false});
          remainingTickets -= 10
          if (remainingTickets <= 0) return;
        }
      });

      it("should emit gameEnded event", async () => {
        expectEvent(receipt, "GameEnded", {gameNumber: new BN("1")})
      })

      it("should emit RandomNumberQuerySent event", async() => {
        expectEvent(receipt, "RandomNumberQuerySent", {gameNumber: new BN("1")})
      })
    })
  });

  // context("With GSN", async () => {
  //   const [Alice] = accounts;
  //   ngntInstance = await ngntContract.at(ngnt);
  //   before(async () => {
  //     const paymasterInstance = await paymasterContract.new();
  //     await paymasterInstance.setRelayHub(relayHub);
  //     paymasterAddress = paymasterInstance.address;

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
  //     web3 = new Web3(provider);
  //     winNgntInstance = await winNgntContract.new(
  //       ngnt,
  //       pegswap,
  //       LINK_ERC20,
  //       wbnb,
  //       pancakeRouter,
  //       vrfCoordinator,
  //       LINK_ERC677,
  //       trustedForwarder,
  //       maximumPurchasableTickets
  //     );

  //     const relayHubInstance = new web3.eth.Contract(
  //       relayHubContract.abi,
  //       relayHub
  //     );
  //     await relayHubInstance.methods
  //       .depositFor(paymasterAddress)
  //       .send({ from: Alice, value: web3.utils.toWei("2"), useGSN: false });

  //     await ngntInstance.approve(winNgntInstance.address, MAX_UINT256, {
  //         from: Alice,
  //       });

  //     await ngntInstance.transfer(Alice, 1000000, {
  //         from: buyer,
  //       });

  //     winNgntInstance = new web3.eth.Contract(
  //       winNgntContract.abi,
  //       winNgntInstance.address
  //     );
  //   });

  //   console.log(Alice)

  // });
});
