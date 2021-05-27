// SPDX-License-Identifier:MIT
pragma solidity ^0.6.0;

import "./SafeStringCast.sol";
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "./interfaces/IUniswapExchange.sol";
import { SafeIntCast } from "./SafeIntCast.sol";
//import "@0x/contracts-utils/contracts/src/LibBytes.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import "@opengsn/gsn/contracts/BaseRelayRecipient.sol";
import "@chainlink/contracts/src/v0.6/VRFConsumerBase.sol";

contract WinNgnt is BaseRelayRecipient, VRFConsumerBase{
    using SafeStringCast for string;

    IERC20 private _ngnt;
    IUniswapExchange private _uniswap;
    uint public TOTAL_NGNT = 0;

    struct Game {
        uint gameNumber;
        address[] tickets;
        address gameWinner;
    }

    uint public commission;
    uint public gameNumber = 1;
    uint public deadline = 1742680400;
    uint public ticketPrice = 50000;
    uint public minimumEther = 1 wei;
    uint public maximumPurchasableTickets = 250;
    uint public maximumTicketsPerAddress = 10;
    uint public oneEther = 1000000000000000000;
    uint public targetAmount = 1000000000000000000;
    uint immutable internal chainLinkFee;

    bool public exchangeContractApproval;

    string public override versionRecipient = "2.2.0+opengsn.sample.irelayrecipient";

    bytes32 immutable internal keyHash;

    mapping(uint => Game) public games;
    mapping(address => uint) public addressTicketCount;
    mapping(uint => mapping(address => uint)) public addressTicketCountPerGame;
    mapping(address => bool) public addressHasPaidGsnFee;
    mapping(bytes32 => bool) public pendingQueries;

    event GameEnded(uint gameNumber);
    event BoughtTicket(address indexed buyer, uint numOfTickets, uint totalTicketPrice);
    event RandomNumberQuerySent(bytes32 queryId, uint indexed gameNumber);
    event RandomNumberGenerated(uint16 randomNumber, uint indexed gameNumber);
    event WinnerSelected(address winner, uint amount, uint indexed gameNumber);



    modifier atLeastOneTicket(uint numberOfTickets){
        require(numberOfTickets >= 1, "WinNgnt:Cannot buy less than one ticket");
        _;
    }

    modifier ticketLimitNotExceed(uint numberOfTickets){
        require((games[gameNumber].tickets.length + numberOfTickets) <= maximumPurchasableTickets, "WinNgnt:Total ticket per game limit exceeded");
        _;
    }

    modifier maxTicketPerAddressLimitNotExceed(address _address, uint numberOfTickets){
        require((addressTicketCountPerGame[gameNumber][_address] + numberOfTickets) <= maximumTicketsPerAddress, "WinNgnt:Maximum ticket limit per address exceeded");
        _;
    }

    modifier queryIdHasNotBeenProcessed(bytes32 queryId){
        require (pendingQueries[queryId] == true, "WinNgnt:QueryId has been processed");
        _;
    }

    constructor(IERC20 ngnt, uint _maximumPurchasableTickets) 
        VRFConsumerBase(
            0xa555fC018435bef5A13C6c6870a9d4C11DEC329C, 
            0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06
            ) 
        public {
        _ngnt = ngnt;
        //_uniswap = uniswap;
        maximumPurchasableTickets = _maximumPurchasableTickets;
        keyHash = 0xcaf3c3727e033261d383b315559476f48034c13b18f8cafed4d871abe5049186;
        chainLinkFee = 0.1 * 1e18; 
    }

    function buyTicket(uint numberOfTickets) atLeastOneTicket(numberOfTickets) ticketLimitNotExceed(numberOfTickets)
    maxTicketPerAddressLimitNotExceed(_msgSender(), numberOfTickets)
    external
    {
        uint totalTicketPrice = ticketPrice.mul(numberOfTickets);
        uint totalAddressTicketCount = addressTicketCount[_msgSender()];
        uint totalAddressTicketCountPerGame = addressTicketCountPerGame[gameNumber][_msgSender()];

        if (!addressHasPaidGsnFee[_msgSender()]) {
            //uint gsnFee = _ngnt.gsnFee();
            uint gsnFee = 5000;
            if (gsnFee <= 0) {
                gsnFee = 5000;
            }

            totalTicketPrice = totalTicketPrice.sub(gsnFee);
            addressHasPaidGsnFee[_msgSender()] = true;
        }

        TOTAL_NGNT += totalTicketPrice;
        _ngnt.transferFrom(_msgSender(), address(this), totalTicketPrice);

        totalAddressTicketCount += numberOfTickets;
        totalAddressTicketCountPerGame += numberOfTickets;
        
        addressTicketCount[_msgSender()] = totalAddressTicketCount;
        addressTicketCountPerGame[gameNumber][_msgSender()] = totalAddressTicketCountPerGame;

        Game storage game = games[gameNumber];
        game.gameNumber = gameNumber;
        for(uint i = 0; i < numberOfTickets; i++){
            game.tickets.push(_msgSender());
        }

        emit BoughtTicket(_msgSender(), numberOfTickets, totalTicketPrice);

        if(games[gameNumber].tickets.length == maximumPurchasableTickets){
            // if(gameNumber.mod(5) == 0){
            //     swapNgntForEth();
            //     fundRecipient();
            // }
            endGame();
        }
    }

    function numberOfTicketsLeft() external view returns (uint){
        Game storage game = games[gameNumber];
        uint ticketsBought = game.tickets.length;
        return maximumPurchasableTickets.sub(ticketsBought);
    }

    function numberOfTicketsPurchased() external view returns(uint){
        Game storage game = games[gameNumber];
        uint ticketsBought = game.tickets.length;
        return ticketsBought;
    }

    function getNgntAddress() external view returns(address){
        return address(_ngnt);
    }

    function fulfillRandomness(bytes32 queryId, uint256 randomness)
        internal override 
        queryIdHasNotBeenProcessed(queryId){
        require(games[gameNumber].tickets.length == maximumPurchasableTickets);
        delete pendingQueries[queryId];
        uint16 randomIndex = uint16(randomness.mod(maximumPurchasableTickets) + 1);

        emit RandomNumberGenerated(randomIndex, gameNumber);
        sendNgntToWinner(randomIndex);
    }

    function generateRandomNumber() private {
        require(LINK.balanceOf(address(this)) >= chainLinkFee, "Win");
        bytes32 queryId = requestRandomness(keyHash, chainLinkFee, block.timestamp);
        pendingQueries[queryId] = true;
        emit RandomNumberQuerySent(queryId, gameNumber);
    }

    function startNextGame() public {
        generateRandomNumber();
    }

    function sendNgntToWinner(uint randomIndex) private {
        Game storage game = games[gameNumber-1];
        address winner = game.tickets[randomIndex];
        game.gameWinner = winner;

        uint amountWon = TOTAL_NGNT.mul(90).div(100);
        commission += TOTAL_NGNT.sub(amountWon);
        resetGame();
        _ngnt.transfer(winner, amountWon);

        emit WinnerSelected(winner, amountWon, gameNumber);
    }

    // function swapNgntForEth() private {
    //     if(address(this).balance < oneEther){
    //         if(!exchangeContractApproval){
    //             _ngnt.approve(address(_uniswap), 100000000000);
    //             exchangeContractApproval = true;
    //         }

    //         uint tokenSold = commission;
    //         _uniswap.tokenToEthSwapInput(tokenSold, minimumEther, deadline);
    //         commission = 0;
    //     }
    // }

    function fundRecipient() private {
        //uint relayBalance = _relayHub.balanceOf(address(this));
        // if(relayBalance < targetAmount){
        //     uint amountDifference = targetAmount.sub(relayBalance);
        //     if(address(this).balance > amountDifference){
        //         _relayHub.depositFor.value(amountDifference)(address(this));
        //     }else{
        //         _relayHub.depositFor.value(address(this).balance)(address(this));
        //     }
        // }
    }

    function resetGame() private {
        gameNumber++;
        TOTAL_NGNT = 0;
    }

    function endGame() private {
        emit GameEnded(gameNumber);
        generateRandomNumber();
    }

    function setForwarder(address _forwarder) public{
        trustedForwarder = _forwarder;
    }

    receive () external payable {
    }
}
