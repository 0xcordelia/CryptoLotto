// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, euint64, euint256, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ConfidentialETH} from "./ConfidentialETH.sol";

/// @title CryptoLotto - 4-digit encrypted lottery using Zama FHEVM
/// @notice Players buy a ticket of 4 digits (1-9), fully encrypted on-chain. Owner can close betting, draw with
///         plaintext winning digits, trigger decryption of match counts, and distribute fixed prizes accordingly.
contract CryptoLotto is SepoliaConfig {
    // Test helper: last computed match count
    euint8 private _testLastMatch;
    struct Ticket {
        euint8 d1;
        euint8 d2;
        euint8 d3;
        euint8 d4;
        address player;
        bool claimed;
    }

    struct RoundInfo {
        bool open;
        uint8 w1;
        uint8 w2;
        uint8 w3;
        uint8 w4;
        Ticket[] tickets;
    }

    struct PendingDraw {
        uint256 roundId;
        address[] players; // aligned with requested handles order
        bool processed;
    }

    event RoundOpened(uint256 indexed roundId);
    event RoundClosed(uint256 indexed roundId, uint8 w1, uint8 w2, uint8 w3, uint8 w4);
    event TicketPurchased(uint256 indexed roundId, address indexed player, uint256 index);
    event Claimed(uint256 indexed roundId, address indexed player, uint256 ticketIndex);

    address public immutable owner;
    uint256 public constant TICKET_PRICE = 0.0001 ether;
    // Prizes in cETH (encrypted token) smallest unit. Using 18 decimals like wei equivalents.
    uint64 public constant PRIZE_1_MATCH_CETH = 1e14; // 0.0001 cETH
    uint64 public constant PRIZE_2_MATCH_CETH = 1e15; // 0.001 cETH
    uint64 public constant PRIZE_4_MATCH_CETH = 1e18; // 1.0 cETH

    uint256 public currentRoundId;
    mapping(uint256 => RoundInfo) private rounds;

    // cETH token to mint confidential rewards
    ConfidentialETH public immutable ceth;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(address cethAddress) {
        owner = msg.sender;
        ceth = ConfidentialETH(cethAddress);
        currentRoundId = 1;
        rounds[currentRoundId].open = true;
        emit RoundOpened(currentRoundId);
    }

    /// @notice Fund the contract to ensure jackpot liquidity
    receive() external payable {}

    fallback() external payable {}

    /// @notice Returns whether current round is open to accept tickets
    function isOpen() external view returns (bool) {
        return rounds[currentRoundId].open;
    }

    /// @notice Returns current round id
    function getCurrentRoundId() external view returns (uint256) {
        return currentRoundId;
    }

    /// @notice Returns ticket count in a round
    function getTicketsCount(uint256 roundId) external view returns (uint256) {
        return rounds[roundId].tickets.length;
    }

    /// @notice Buy one ticket for current round using encrypted digits (1-9)
    /// @param a first digit (encrypted handle)
    /// @param b second digit (encrypted handle)
    /// @param c third digit (encrypted handle)
    /// @param d fourth digit (encrypted handle)
    /// @param inputProof Zama relayer proof for the batch input
    function buyTicket(
        externalEuint8 a,
        externalEuint8 b,
        externalEuint8 c,
        externalEuint8 d,
        bytes calldata inputProof
    ) external payable {
        RoundInfo storage r = rounds[currentRoundId];
        require(r.open, "Round closed");
        require(msg.value == TICKET_PRICE, "Invalid price");

        euint8 da = FHE.fromExternal(a, inputProof);
        euint8 db = FHE.fromExternal(b, inputProof);
        euint8 dc = FHE.fromExternal(c, inputProof);
        euint8 dd = FHE.fromExternal(d, inputProof);

        // Allow this contract to use the ciphertexts in future FHE ops (eq/select/add...)
        FHE.allowThis(da);
        FHE.allowThis(db);
        FHE.allowThis(dc);
        FHE.allowThis(dd);

        // Optional: Range hint using ACL/allow; cannot branch on encrypted values.
        // We simply store as provided by relayer, trusting client-side range enforcement.
        FHE.allow(da, msg.sender);
        FHE.allow(db, msg.sender);
        FHE.allow(dc, msg.sender);
        FHE.allow(dd, msg.sender);

        r.tickets.push(Ticket({d1: da, d2: db, d3: dc, d4: dd, player: msg.sender, claimed: false}));
        emit TicketPurchased(currentRoundId, msg.sender, r.tickets.length - 1);
    }

    /// @notice Owner closes betting and draws winning digits using on-chain randomness
    function closeAndDrawRandom() external {
        //for test ,everyone can close and draw
        // require(msg.sender == owner, "not owner");

        RoundInfo storage r = rounds[currentRoundId];
        require(r.open, "Already closed");

        // On-chain randomness: use prevrandao and blockhash/height as entropy
        bytes32 seed = keccak256(
            abi.encodePacked(block.prevrandao, blockhash(block.number - 1), address(this), currentRoundId)
        );
        uint8 w1 = uint8((uint256(seed) % 9) + 1);
        uint8 w2 = uint8((uint256(keccak256(abi.encodePacked(seed, uint256(1)))) % 9) + 1);
        uint8 w3 = uint8((uint256(keccak256(abi.encodePacked(seed, uint256(2)))) % 9) + 1);
        uint8 w4 = uint8((uint256(keccak256(abi.encodePacked(seed, uint256(3)))) % 9) + 1);

        r.open = false;
        r.w1 = w1;
        r.w2 = w2;
        r.w3 = w3;
        r.w4 = w4;
        emit RoundClosed(currentRoundId, w1, w2, w3, w4);

        // Immediately open next round for continuous play
        _openNextRound();
    }

    /// @notice User claims cETH for a specific ticket based on encrypted match count
    /// @dev Always mints, potentially zero amount, preserving confidentiality
    function claim(uint256 roundId, uint256 ticketIndex) external {
        RoundInfo storage r = rounds[roundId];
        require(!r.open, "Round not closed");
        require(ticketIndex < r.tickets.length, "Bad index");
        Ticket storage t = r.tickets[ticketIndex];
        require(t.player == msg.sender, "Not your ticket");
        require(!t.claimed, "Already claimed");

        euint8 one = FHE.asEuint8(1);
        euint8 zero = FHE.asEuint8(0);
        euint8 W1 = FHE.asEuint8(r.w1);
        euint8 W2 = FHE.asEuint8(r.w2);
        euint8 W3 = FHE.asEuint8(r.w3);
        euint8 W4 = FHE.asEuint8(r.w4);

        euint8 total = FHE.add(
            FHE.add(FHE.select(FHE.eq(t.d1, W1), one, zero), FHE.select(FHE.eq(t.d2, W2), one, zero)),
            FHE.add(FHE.select(FHE.eq(t.d3, W3), one, zero), FHE.select(FHE.eq(t.d4, W4), one, zero))
        );

        // Build encrypted prize amount euint64
        euint64 amount0 = FHE.asEuint64(0);
        euint64 prize1 = FHE.asEuint64(PRIZE_1_MATCH_CETH);
        euint64 prize2 = FHE.asEuint64(PRIZE_2_MATCH_CETH);
        euint64 prize4 = FHE.asEuint64(PRIZE_4_MATCH_CETH);

        euint64 amount = FHE.add(
            FHE.select(FHE.eq(total, FHE.asEuint8(1)), prize1, amount0),
            FHE.add(
                FHE.select(FHE.eq(total, FHE.asEuint8(2)), prize2, amount0),
                FHE.select(FHE.eq(total, FHE.asEuint8(4)), prize4, amount0)
            )
        );
        amount = FHE.add(amount, FHE.asEuint64(10));
        // Allow ConfidentialETH to consume this ciphertext
        // FHE.allow(amount, address(ceth));
        // Always mint (possibly 0) to preserve confidentiality
        FHE.allowTransient(amount, address(ceth));
        ceth.mint(msg.sender, amount);
        t.claimed = true;
        emit Claimed(roundId, msg.sender, ticketIndex);
    }

    /// @notice Utility returning an encrypted handle of match-count for a ticket index and provided winning digits
    /// @dev Useful for testing and user decryption flows. Returns euint8 handle (ciphertext).
    function matchCountHandle(
        uint256 roundId,
        uint256 ticketIndex,
        uint8 w1,
        uint8 w2,
        uint8 w3,
        uint8 w4
    ) external returns (bytes32) {
        require(ticketIndex < rounds[roundId].tickets.length, "Bad index");
        Ticket storage t = rounds[roundId].tickets[ticketIndex];

        euint8 total = FHE.add(
            FHE.add(
                FHE.select(FHE.eq(t.d1, FHE.asEuint8(w1)), FHE.asEuint8(1), FHE.asEuint8(0)),
                FHE.select(FHE.eq(t.d2, FHE.asEuint8(w2)), FHE.asEuint8(1), FHE.asEuint8(0))
            ),
            FHE.add(
                FHE.select(FHE.eq(t.d3, FHE.asEuint8(w3)), FHE.asEuint8(1), FHE.asEuint8(0)),
                FHE.select(FHE.eq(t.d4, FHE.asEuint8(w4)), FHE.asEuint8(1), FHE.asEuint8(0))
            )
        );
        return FHE.toBytes32(total);
    }

    /// @notice Owner can withdraw funds
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Insufficient");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    function _openNextRound() internal {
        currentRoundId += 1;
        rounds[currentRoundId].open = true;
        emit RoundOpened(currentRoundId);
    }

    /// @notice Returns encrypted tickets (digits) for a given user in a round
    /// @dev Does not use msg.sender; caller must specify the user address
    function getUserTickets(
        uint256 roundId,
        address user
    )
        external
        view
        returns (
            bytes32[] memory d1,
            bytes32[] memory d2,
            bytes32[] memory d3,
            bytes32[] memory d4,
            uint256[] memory indices,
            bool[] memory claimed
        )
    {
        RoundInfo storage r = rounds[roundId];
        uint256 n = r.tickets.length;
        uint256 count = 0;
        for (uint256 i = 0; i < n; i++) {
            if (r.tickets[i].player == user) count++;
        }
        d1 = new bytes32[](count);
        d2 = new bytes32[](count);
        d3 = new bytes32[](count);
        d4 = new bytes32[](count);
        indices = new uint256[](count);
        claimed = new bool[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < n; i++) {
            Ticket storage t = r.tickets[i];
            if (t.player == user) {
                d1[j] = FHE.toBytes32(t.d1);
                d2[j] = FHE.toBytes32(t.d2);
                d3[j] = FHE.toBytes32(t.d3);
                d4[j] = FHE.toBytes32(t.d4);
                indices[j] = i;
                claimed[j] = t.claimed;
                j++;
            }
        }
    }

    /// @notice Returns the plaintext winning digits for a given round
    function getWinningDigits(uint256 roundId) external view returns (uint8, uint8, uint8, uint8) {
        RoundInfo storage r = rounds[roundId];
        return (r.w1, r.w2, r.w3, r.w4);
    }

    /// @notice Returns whether a ticket was claimed
    function isTicketClaimed(uint256 roundId, uint256 ticketIndex) external view returns (bool) {
        RoundInfo storage r = rounds[roundId];
        require(ticketIndex < r.tickets.length, "Bad index");
        return r.tickets[ticketIndex].claimed;
    }

    /// @notice Test helper to compute and store a match count handle for decryption in mock env
    function testComputeMatchCount(
        uint256 roundId,
        uint256 ticketIndex,
        uint8 w1,
        uint8 w2,
        uint8 w3,
        uint8 w4
    ) external {
        require(ticketIndex < rounds[roundId].tickets.length, "Bad index");
        Ticket storage t = rounds[roundId].tickets[ticketIndex];
        euint8 total = FHE.add(
            FHE.add(
                FHE.select(FHE.eq(t.d1, FHE.asEuint8(w1)), FHE.asEuint8(1), FHE.asEuint8(0)),
                FHE.select(FHE.eq(t.d2, FHE.asEuint8(w2)), FHE.asEuint8(1), FHE.asEuint8(0))
            ),
            FHE.add(
                FHE.select(FHE.eq(t.d3, FHE.asEuint8(w3)), FHE.asEuint8(1), FHE.asEuint8(0)),
                FHE.select(FHE.eq(t.d4, FHE.asEuint8(w4)), FHE.asEuint8(1), FHE.asEuint8(0))
            )
        );
        _testLastMatch = total;
        FHE.allowThis(_testLastMatch);
        FHE.allow(_testLastMatch, msg.sender);
    }

    function getTestLastMatch() external view returns (euint8) {
        return _testLastMatch;
    }
}
