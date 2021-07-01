// SPDX-License-Identifier:MIT
pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IPancakeRouter02.sol";
import "./interfaces/IPegswap.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@opengsn/contracts/src/BaseRelayRecipient.sol";
import "@chainlink/contracts/src/v0.7/dev/VRFConsumerBase.sol";
import "./tokens/NGNT.sol";

contract WinNgnt is BaseRelayRecipient, VRFConsumerBase {
    using SafeMath for uint256;

    NGNTContract public NGNT;
    //ERC20 version of original ERC677 token
    IERC20 public LINK_ERC20;
    IPancakeRouter02 private pancakeswap;
    IPegswap public pegswap;

    address public WBNB;
    uint256 public TOTAL_NGNT = 0;

    struct Game {
        address[] tickets;
        address gameWinner;
    }

    uint256 public commission;
    uint256 public gameNumber = 1;
    uint256 public ticketPrice = 50000;
    uint256 public maximumPurchasableTickets = 250;
    uint256 public maximumTicketsPerAddress = 250;
    uint256 gsnFee = 5000;
    uint256 internal chainLinkFee;


    string public override versionRecipient =
        "2.2.0+opengsn.sample.irelayrecipient";

    bytes32 internal keyHash;

    mapping(uint256 => Game) public games;
    mapping(address => uint256) public addressTicketCount;
    mapping(uint256 => mapping(address => uint256))
        public addressTicketCountPerGame;
    mapping(bytes32 => bool) public pendingQueries;

    event GameEnded(uint256 gameNumber);
    event BoughtTicket(
        address indexed buyer,
        uint256 numOfTickets,// SPDX-License-Identifier:MIT
        uint256 totalTicketPrice
    );
    event RandomNumberQuerySent(bytes32 queryId, uint256 indexed gameNumber);
    event RandomNumberGenerated(
        uint16 randomNumber,
        uint256 indexed gameNumber
    );
    event WinnerSelected(
        address winner,
        uint256 amount,
        uint256 indexed gameNumber
    );

    modifier atLeastOneTicket(uint256 numberOfTickets) {
        require(
            numberOfTickets >= 1,
            "WinNgnt:Cannot buy less than one ticket"
        );
        _;
    }

    modifier ticketLimitNotExceed(uint256 numberOfTickets) {
        require(
            (games[gameNumber].tickets.length + numberOfTickets) <=
                maximumPurchasableTickets,
            "WinNgnt:Total ticket per game limit exceeded"
        );
        _;
    }

    modifier maxTicketPerAddressLimitNotExceed(
        address _address,
        uint256 numberOfTickets
    ) {
        require(
            (addressTicketCountPerGame[gameNumber][_address] +
                numberOfTickets) <= maximumTicketsPerAddress,
            "WinNgnt:Maximum ticket limit per address exceeded"
        );
        _;
    }

    modifier queryIdHasNotBeenProcessed(bytes32 queryId) {
        require(
            pendingQueries[queryId] == true,
            "WinNgnt:QueryId has been processed"
        );
        _;
    }

    modifier checkTrustedForwarder() {
        if (msg.sender != _msgSender()) {
            require(
                msg.sender == trustedForwarder,
                "WinNgnt:Not a trusted forwarder"
            );
        }
        _;
    }

    constructor(
        NGNTContract _NGNT,
        IPegswap _pegswap,
        IERC20 _LINK_ERC20,
        address _WBNB,
        IPancakeRouter02 _pancakeswap,
        address _vrfCoordinator,
        address _LINK_ERC677,
        
        uint256 _maximumPurchasableTickets
    )
        VRFConsumerBase(
            _vrfCoordinator,
            _LINK_ERC677
        )
    {
        NGNT = _NGNT;
        pegswap = _pegswap;
        LINK_ERC20 = _LINK_ERC20;
        WBNB = _WBNB;
        pancakeswap = _pancakeswap;
        maximumPurchasableTickets = _maximumPurchasableTickets;
        keyHash = 0xcaf3c3727e033261d383b315559476f48034c13b18f8cafed4d871abe5049186;
        chainLinkFee = 0.2 * 1e18;
    }

    function buyTicket(uint256 numberOfTickets)
        external
        atLeastOneTicket(numberOfTickets)
        ticketLimitNotExceed(numberOfTickets)
        maxTicketPerAddressLimitNotExceed(_msgSender(), numberOfTickets)
        checkTrustedForwarder
    {
        uint256 totalTicketPrice = ticketPrice.mul(numberOfTickets);
        uint256 totalAddressTicketCount = addressTicketCount[_msgSender()];
        uint256 totalAddressTicketCountPerGame =
            addressTicketCountPerGame[gameNumber][_msgSender()];


        NGNT.transferFrom(_msgSender(), address(this), totalTicketPrice);
        uint addCommission = gsnFee.mul(numberOfTickets);
        totalTicketPrice = totalTicketPrice.sub(addCommission);
        commission += addCommission;
        

        TOTAL_NGNT += totalTicketPrice;

        totalAddressTicketCount += numberOfTickets;
        totalAddressTicketCountPerGame += numberOfTickets;

        addressTicketCount[_msgSender()] = totalAddressTicketCount;
        addressTicketCountPerGame[gameNumber][
            _msgSender()
        ] = totalAddressTicketCountPerGame;

        Game storage game = games[gameNumber];
        for (uint256 i = 0; i < numberOfTickets; i++) {
            game.tickets.push(_msgSender());
        }

        emit BoughtTicket(_msgSender(), numberOfTickets, totalTicketPrice);

        if (games[gameNumber].tickets.length == maximumPurchasableTickets) {
            // if(gameNumber.mod(5) == 0){
            //     swapNgntForEth();
            //     fundRecipient();
            // }

            uint LINK_ERC677_Balance = LINK_ERC677.balanceOf(address(this));
            if (LINK_ERC677_Balance < chainLinkFee) {
                
                uint amountOut = chainLinkFee - LINK_ERC677_Balance;

                address[] memory path = new address[](3);
                (path[0], path[1], path[2]) = (
                    address(NGNT),
                    WBNB,
                    address(LINK_ERC20)
                );
                
                uint[] memory amountsIn = pancakeswap.getAmountsIn(amountOut, path);

                if(commission >= amountsIn[0]){
                    swapNGNTForLINK_ERC20(amountsIn[0], amountOut, path);
                    swapLINK_ERC20ForLINK_ERC677(amountOut);
                }
            }
            endGame();
        }
    }

    function numberOfTicketsLeft() external view returns (uint256) {
        Game storage game = games[gameNumber];
        uint256 ticketsBought = game.tickets.length;
        return maximumPurchasableTickets.sub(ticketsBought);
    }

    function numberOfTicketsPurchased() external view returns (uint256) {
        Game storage game = games[gameNumber];
        uint256 ticketsBought = game.tickets.length;
        return ticketsBought;
    }

    function getNgntAddress() external view returns (address) {
        return address(NGNT);
    }

    function fulfillRandomness(bytes32 queryId, uint256 randomness)
        internal
        override
        queryIdHasNotBeenProcessed(queryId)
    {
        require(games[gameNumber].tickets.length == maximumPurchasableTickets);
        delete pendingQueries[queryId];
        uint16 randomIndex =
            uint16(randomness.mod(maximumPurchasableTickets) + 1);

        emit RandomNumberGenerated(randomIndex, gameNumber);
        sendNgntToWinner(randomIndex);
    }

    function generateRandomNumber() private {
        require(
            LINK_ERC677.balanceOf(address(this)) >= chainLinkFee,
            "WinNgnt: LINK_ERC677 balance not enough for query"
        );
        bytes32 queryId =
            requestRandomness(keyHash, chainLinkFee, block.timestamp);
        pendingQueries[queryId] = true;
        emit RandomNumberQuerySent(queryId, gameNumber);
    }

    function startNextGame() public {
        generateRandomNumber();
    }

    function sendNgntToWinner(uint256 randomIndex) private {
        Game storage game = games[gameNumber];
        address winner = game.tickets[randomIndex];
        game.gameWinner = winner;

        uint256 amountWon = TOTAL_NGNT.mul(90).div(100);
        commission += TOTAL_NGNT.sub(amountWon);
        resetGame();
        NGNT.transfer(winner, amountWon);

        emit WinnerSelected(winner, amountWon, gameNumber);
    }

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

    function swapNGNTForLINK_ERC20(uint256 _amountIn, uint256 _amountOut, address[] memory path) private {
        if (NGNT.allowance(address(this), address(pancakeswap)) < _amountIn) {
            NGNT.approve(address(pancakeswap), type(uint256).max);
        }

        pancakeswap.swapTokensForExactTokens(
            _amountOut,
            _amountIn,
            path,
            address(this),
            block.timestamp + 20 minutes
        );
    }

    function swapLINK_ERC20ForLINK_ERC677(uint256 _amount) private {
        if (LINK_ERC20.allowance(address(this), address(pegswap)) < _amount) {
            LINK_ERC20.approve(address(pegswap), type(uint256).max);
        }

        require(
            LINK_ERC20.balanceOf(address(this)) >= _amount,
            "WinNgnt: ERC20 LINK balance not enough for swap"
        );
        pegswap.swap(_amount, address(LINK_ERC20), address(LINK_ERC677));
    }

    function resetGame() private {
        gameNumber++;
        TOTAL_NGNT = 0;
    }

    function endGame() private {
        emit GameEnded(gameNumber);
        if(LINK_ERC677.balanceOf(address(this)) >= chainLinkFee) generateRandomNumber();
    }

    function setForwarder(address _forwarder) public {
        trustedForwarder = _forwarder;
    }

    receive() external payable {}
}
