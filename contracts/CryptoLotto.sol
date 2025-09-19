// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, euint64, externalEuint8, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract CryptoLotto is SepoliaConfig {
    
    uint256 public constant BET_PRICE = 0.0001 ether;
    uint256 public constant TWO_MATCH_PRIZE = 0.0001 ether;
    uint256 public constant FULL_MATCH_PRIZE = 1 ether;
    uint256 public constant MAX_LOTTERY_NUMBER = 9;
    
    address public owner;
    uint256 public currentRound;
    bool public bettingOpen;
    
    struct Bet {
        address player;
        euint8[6] numbers;
        uint256 round;
        bool exists;
    }
    
    struct Round {
        euint8[6] winningNumbers;
        bool hasWinningNumbers;
        bool isActive;
        uint256 totalBets;
        uint256 prizePool;
    }
    
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(address => Bet[])) public playerBets;
    mapping(uint256 => address[]) public roundPlayers;
    mapping(uint256 => uint256) public roundPlayerCount;
    
    event BetPlaced(address indexed player, uint256 indexed round, uint256 betIndex);
    event RoundEnded(uint256 indexed round);
    event RoundStarted(uint256 indexed round);
    event WinningPayout(address indexed winner, uint256 amount, uint256 matches);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier bettingMustBeOpen() {
        require(bettingOpen, "Betting is currently closed");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        currentRound = 1;
        bettingOpen = true;
        
        rounds[currentRound] = Round({
            winningNumbers: [euint8.wrap(0), euint8.wrap(0), euint8.wrap(0), euint8.wrap(0), euint8.wrap(0), euint8.wrap(0)],
            hasWinningNumbers: false,
            isActive: true,
            totalBets: 0,
            prizePool: 0
        });
    }
    
    function placeBet(
        externalEuint8[6] calldata encryptedNumbers,
        bytes calldata inputProof
    ) external payable bettingMustBeOpen {
        require(msg.value == BET_PRICE, "Incorrect bet amount");
        require(rounds[currentRound].isActive, "Current round is not active");
        
        euint8[6] memory numbers;
        for (uint256 i = 0; i < 6; i++) {
            numbers[i] = FHE.fromExternal(encryptedNumbers[i], inputProof);
            FHE.allowThis(numbers[i]);
            FHE.allow(numbers[i], msg.sender);
        }
        
        Bet memory newBet = Bet({
            player: msg.sender,
            numbers: numbers,
            round: currentRound,
            exists: true
        });
        
        if (playerBets[currentRound][msg.sender].length == 0) {
            roundPlayers[currentRound].push(msg.sender);
            roundPlayerCount[currentRound]++;
        }
        
        playerBets[currentRound][msg.sender].push(newBet);
        rounds[currentRound].totalBets++;
        rounds[currentRound].prizePool += msg.value;
        
        emit BetPlaced(msg.sender, currentRound, playerBets[currentRound][msg.sender].length - 1);
    }
    
    function endRoundAndDraw() external onlyOwner {
        require(rounds[currentRound].isActive, "Current round is not active");
        require(bettingOpen, "Betting already closed");
        
        bettingOpen = false;
        
        euint8[6] memory winningNumbers;
        for (uint256 i = 0; i < 6; i++) {
            euint8 randomValue = FHE.randEuint8(16);
            winningNumbers[i] = FHE.rem(randomValue, 10);
            FHE.allowThis(winningNumbers[i]);
        }
        
        rounds[currentRound].winningNumbers = winningNumbers;
        rounds[currentRound].hasWinningNumbers = true;
        rounds[currentRound].isActive = false;
        
        emit RoundEnded(currentRound);
    }
    
    function startNewRound() external onlyOwner {
        require(!bettingOpen, "Previous round must be ended first");
        require(!rounds[currentRound].isActive, "Current round is still active");
        
        currentRound++;
        bettingOpen = true;
        
        rounds[currentRound] = Round({
            winningNumbers: [euint8.wrap(0), euint8.wrap(0), euint8.wrap(0), euint8.wrap(0), euint8.wrap(0), euint8.wrap(0)],
            hasWinningNumbers: false,
            isActive: true,
            totalBets: 0,
            prizePool: 0
        });
        
        emit RoundStarted(currentRound);
    }
    
    function getMatchResult(uint256 roundNumber, uint256 betIndex) external returns (euint8) {
        require(betIndex < playerBets[roundNumber][msg.sender].length, "Invalid bet index");
        require(rounds[roundNumber].hasWinningNumbers, "Winning numbers not set");
        
        Bet storage bet = playerBets[roundNumber][msg.sender][betIndex];
        require(bet.exists, "Bet does not exist");
        
        return calculateMatches(bet.numbers, rounds[roundNumber].winningNumbers);
    }
    
    function claimWinnings(uint256 roundNumber, uint256 betIndex) external {
        require(roundNumber < currentRound || !rounds[roundNumber].isActive, "Round still active");
        require(rounds[roundNumber].hasWinningNumbers, "Winning numbers not set");
        require(betIndex < playerBets[roundNumber][msg.sender].length, "Invalid bet index");
        
        Bet storage bet = playerBets[roundNumber][msg.sender][betIndex];
        require(bet.exists, "Bet does not exist");
        
        euint8 matches = calculateMatches(bet.numbers, rounds[roundNumber].winningNumbers);
        
        FHE.allowThis(matches);
        FHE.allow(matches, msg.sender);
        
        bet.exists = false;
        
        emit WinningPayout(msg.sender, 0, 0);
    }
    
    function calculateMatches(euint8[6] memory, euint8[6] memory) internal returns (euint8) {
        return FHE.asEuint8(0);
    }
    
    function getPlayerBets(address player, uint256 roundNumber) external view returns (uint256) {
        return playerBets[roundNumber][player].length;
    }
    
    function getPlayerBet(address player, uint256 roundNumber, uint256 betIndex) external view returns (euint8[6] memory) {
        require(betIndex < playerBets[roundNumber][player].length, "Invalid bet index");
        return playerBets[roundNumber][player][betIndex].numbers;
    }
    
    function getRoundInfo(uint256 roundNumber) external view returns (
        bool hasWinningNumbers,
        bool isActive,
        uint256 totalBets,
        uint256 prizePool
    ) {
        Round storage round = rounds[roundNumber];
        return (
            round.hasWinningNumbers,
            round.isActive,
            round.totalBets,
            round.prizePool
        );
    }
    
    function getWinningNumbers(uint256 roundNumber) external view returns (euint8[6] memory) {
        require(rounds[roundNumber].hasWinningNumbers, "Winning numbers not set for this round");
        return rounds[roundNumber].winningNumbers;
    }
    
    function getRoundPlayers(uint256 roundNumber) external view returns (address[] memory) {
        return roundPlayers[roundNumber];
    }
    
    function withdrawOwnerFunds(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        payable(owner).transfer(amount);
    }
    
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    receive() external payable {}
}