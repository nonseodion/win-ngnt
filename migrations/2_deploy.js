const WinNgnt = artifacts.require('WinNgnt');
const Ngnt = artifacts.require("NGNT");
const maximumPurchasableTicket = process.env.MAXIMUM_PURCHASABLE_TICKET;

const relayHub = require('../script/relayHub').relayHub;

module.exports = async function (deployer) {
    await deployer.deploy(Ngnt);
    await deployer.deploy( WinNgnt, Ngnt.address, maximumPurchasableTicket);
};