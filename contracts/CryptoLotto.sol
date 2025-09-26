// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint8, euint256, externalEuint8} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title CryptoLotto - 4-digit encrypted lottery using Zama FHEVM
/// @notice Players buy a ticket of 4 digits (0-9), fully encrypted on-chain. Owner can close betting, draw with
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
    }

    struct RoundInfo {
        bool open;
        uint256 requestID; // decryption request id for draw
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
    event PrizeAwarded(uint256 indexed roundId, address indexed player, uint8 matches_, uint256 amount);

    address public immutable owner;
    uint256 public constant TICKET_PRICE = 0.0001 ether;
    uint256 public constant PRIZE_1_MATCH = 0.0001 ether;
    uint256 public constant PRIZE_2_MATCH = 0.001 ether;
    uint256 public constant PRIZE_4_MATCH = 1 ether;

    uint256 public currentRoundId;
    mapping(uint256 => RoundInfo) private rounds;

    // requestID => pending draw metadata
    mapping(uint256 => PendingDraw) private pendingDraws;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
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

    /// @notice Buy one ticket for current round using encrypted digits (0-9)
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

        r.tickets.push(Ticket({d1: da, d2: db, d3: dc, d4: dd, player: msg.sender}));
        emit TicketPurchased(currentRoundId, msg.sender, r.tickets.length - 1);
    }

    /// @notice Owner closes betting and triggers draw & decryption of match counts
    /// @param w1..w4 Winning digits in plaintext (0-9)
    function closeAndDraw(uint8 w1, uint8 w2, uint8 w3, uint8 w4) external onlyOwner {
        RoundInfo storage r = rounds[currentRoundId];
        require(r.open, "Already closed");
        require(w1 < 10 && w2 < 10 && w3 < 10 && w4 < 10, "Digits 0-9");

        r.open = false;
        r.w1 = w1;
        r.w2 = w2;
        r.w3 = w3;
        r.w4 = w4;
        emit RoundClosed(currentRoundId, w1, w2, w3, w4);

        uint256 n = r.tickets.length;
        if (n == 0) {
            // No tickets: directly open next round
            _openNextRound();
            return;
        }

        bytes32[] memory handles = new bytes32[](n);
        address[] memory players = new address[](n);

        euint8 one = FHE.asEuint8(1);
        euint8 zero = FHE.asEuint8(0);
        euint8 W1 = FHE.asEuint8(w1);
        euint8 W2 = FHE.asEuint8(w2);
        euint8 W3 = FHE.asEuint8(w3);
        euint8 W4 = FHE.asEuint8(w4);

        for (uint256 i = 0; i < n; i++) {
            Ticket storage t = r.tickets[i];
            euint8 total = FHE.add(
                FHE.add(
                    FHE.select(FHE.eq(t.d1, W1), one, zero),
                    FHE.select(FHE.eq(t.d2, W2), one, zero)
                ),
                FHE.add(
                    FHE.select(FHE.eq(t.d3, W3), one, zero),
                    FHE.select(FHE.eq(t.d4, W4), one, zero)
                )
            );

            handles[i] = FHE.toBytes32(total);
            players[i] = t.player;
        }

        uint256 requestID = FHE.requestDecryption(handles, this.onDecryptionResult.selector);
        r.requestID = requestID;
        pendingDraws[requestID] = PendingDraw({roundId: currentRoundId, players: players, processed: false});
    }

    /// @notice Callback from Zama relayer with plaintext match counts for previously requested handles
    /// @dev MUST be called by relayer; uses FHE.checkSignatures to validate KMS signatures
    function onDecryptionResult(uint256 requestID, bytes calldata cleartexts, bytes calldata decryptionProof) external {
        // Validate decryption result against KMS signatures and previously requested handles
        FHE.checkSignatures(requestID, cleartexts, decryptionProof);

        PendingDraw storage pd = pendingDraws[requestID];
        require(!pd.processed, "Already processed");

        uint256 roundId = pd.roundId;

        // Parse cleartexts (n x 32 bytes). Copy to memory for loading with mload.
        uint256 n = pd.players.length;
        require(cleartexts.length == n * 32, "Invalid length");
        bytes memory data = cleartexts;

        for (uint256 i = 0; i < n; i++) {
            uint256 offset = i * 32;
            uint8 matches_;
            // solhint-disable-next-line no-inline-assembly
            assembly {
                // load 32 bytes at data[offset], take least significant byte
                matches_ := shr(248, mload(add(add(data, 0x20), offset)))
            }

            uint256 amount = 0;
            if (matches_ == 1) amount = PRIZE_1_MATCH;
            else if (matches_ == 2) amount = PRIZE_2_MATCH;
            else if (matches_ == 4) amount = PRIZE_4_MATCH;

            if (amount > 0) {
                (bool ok, ) = pd.players[i].call{value: amount}("");
                require(ok, "Payout failed");
                emit PrizeAwarded(roundId, pd.players[i], matches_, amount);
            }
        }

        pd.processed = true;
        _openNextRound();
    }

    /// @notice Utility returning an encrypted handle of match-count for a ticket index and provided winning digits
    /// @dev Useful for testing and user decryption flows. Returns euint8 handle (ciphertext).
    function matchCountHandle(uint256 roundId, uint256 ticketIndex, uint8 w1, uint8 w2, uint8 w3, uint8 w4)
        external
        returns (bytes32)
    {
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
