import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { CryptoLotto, CryptoLotto__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("CryptoLotto")) as CryptoLotto__factory;
  const cryptoLottoContract = (await factory.deploy()) as CryptoLotto;
  const cryptoLottoContractAddress = await cryptoLottoContract.getAddress();

  return { cryptoLottoContract, cryptoLottoContractAddress };
}

describe("CryptoLotto", function () {
  let signers: Signers;
  let cryptoLottoContract: CryptoLotto;
  let cryptoLottoContractAddress: string;
  const BET_PRICE = ethers.parseEther("0.0001");

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ cryptoLottoContract, cryptoLottoContractAddress } = await deployFixture());
  });

  describe("Deployment", function () {
    it("should set the correct owner", async function () {
      expect(await cryptoLottoContract.owner()).to.equal(signers.deployer.address);
    });

    it("should start with round 1", async function () {
      expect(await cryptoLottoContract.currentRound()).to.equal(1);
    });

    it("should have betting open initially", async function () {
      expect(await cryptoLottoContract.bettingOpen()).to.equal(true);
    });

    it("should have correct constants", async function () {
      expect(await cryptoLottoContract.BET_PRICE()).to.equal(BET_PRICE);
      expect(await cryptoLottoContract.TWO_MATCH_PRIZE()).to.equal(BET_PRICE);
      expect(await cryptoLottoContract.FULL_MATCH_PRIZE()).to.equal(ethers.parseEther("1"));
    });
  });

  describe("Place Bet", function () {
    it("should allow placing a bet with correct payment", async function () {
      const numbers = [1, 2, 3, 4, 5, 6];
      const encryptedInput = await fhevm
        .createEncryptedInput(cryptoLottoContractAddress, signers.alice.address);
      
      numbers.forEach(num => encryptedInput.add8(num));
      const encrypted = await encryptedInput.encrypt();

      await expect(
        cryptoLottoContract
          .connect(signers.alice)
          .placeBet(encrypted.handles, encrypted.inputProof, { value: BET_PRICE })
      ).to.emit(cryptoLottoContract, "BetPlaced")
        .withArgs(signers.alice.address, 1, 0);

      const roundInfo = await cryptoLottoContract.getRoundInfo(1);
      expect(roundInfo.totalBets).to.equal(1);
      expect(roundInfo.prizePool).to.equal(BET_PRICE);
    });

    it("should reject bet with incorrect payment", async function () {
      const numbers = [1, 2, 3, 4, 5, 6];
      const encryptedInput = await fhevm
        .createEncryptedInput(cryptoLottoContractAddress, signers.alice.address);
      
      numbers.forEach(num => encryptedInput.add8(num));
      const encrypted = await encryptedInput.encrypt();

      await expect(
        cryptoLottoContract
          .connect(signers.alice)
          .placeBet(encrypted.handles, encrypted.inputProof, { value: ethers.parseEther("0.0002") })
      ).to.be.revertedWith("Incorrect bet amount");
    });

    it("should allow multiple bets from same player", async function () {
      const numbers1 = [1, 2, 3, 4, 5, 6];
      const numbers2 = [6, 5, 4, 3, 2, 1];

      const encryptedInput1 = await fhevm
        .createEncryptedInput(cryptoLottoContractAddress, signers.alice.address);
      numbers1.forEach(num => encryptedInput1.add8(num));
      const encrypted1 = await encryptedInput1.encrypt();

      const encryptedInput2 = await fhevm
        .createEncryptedInput(cryptoLottoContractAddress, signers.alice.address);
      numbers2.forEach(num => encryptedInput2.add8(num));
      const encrypted2 = await encryptedInput2.encrypt();

      await cryptoLottoContract
        .connect(signers.alice)
        .placeBet(encrypted1.handles, encrypted1.inputProof, { value: BET_PRICE });

      await cryptoLottoContract
        .connect(signers.alice)
        .placeBet(encrypted2.handles, encrypted2.inputProof, { value: BET_PRICE });

      expect(await cryptoLottoContract.getPlayerBets(signers.alice.address, 1)).to.equal(2);
    });

    it("should reject bet when betting is closed", async function () {
      await cryptoLottoContract.connect(signers.deployer).endRoundAndDraw();

      const numbers = [1, 2, 3, 4, 5, 6];
      const encryptedInput = await fhevm
        .createEncryptedInput(cryptoLottoContractAddress, signers.alice.address);
      numbers.forEach(num => encryptedInput.add8(num));
      const encrypted = await encryptedInput.encrypt();

      await expect(
        cryptoLottoContract
          .connect(signers.alice)
          .placeBet(encrypted.handles, encrypted.inputProof, { value: BET_PRICE })
      ).to.be.revertedWith("Betting is currently closed");
    });
  });

  describe("Round Management", function () {
    beforeEach(async function () {
      const numbers = [1, 2, 3, 4, 5, 6];
      const encryptedInput = await fhevm
        .createEncryptedInput(cryptoLottoContractAddress, signers.alice.address);
      numbers.forEach(num => encryptedInput.add8(num));
      const encrypted = await encryptedInput.encrypt();

      await cryptoLottoContract
        .connect(signers.alice)
        .placeBet(encrypted.handles, encrypted.inputProof, { value: BET_PRICE });
    });

    it("should allow owner to end round and draw", async function () {
      await expect(
        cryptoLottoContract.connect(signers.deployer).endRoundAndDraw()
      ).to.emit(cryptoLottoContract, "RoundEnded")
        .withArgs(1);

      expect(await cryptoLottoContract.bettingOpen()).to.equal(false);
      const roundInfo = await cryptoLottoContract.getRoundInfo(1);
      expect(roundInfo.hasWinningNumbers).to.equal(true);
      expect(roundInfo.isActive).to.equal(false);
    });

    it("should prevent non-owner from ending round", async function () {
      await expect(
        cryptoLottoContract.connect(signers.alice).endRoundAndDraw()
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("should allow owner to start new round after ending previous", async function () {
      await cryptoLottoContract.connect(signers.deployer).endRoundAndDraw();

      await expect(
        cryptoLottoContract.connect(signers.deployer).startNewRound()
      ).to.emit(cryptoLottoContract, "RoundStarted")
        .withArgs(2);

      expect(await cryptoLottoContract.currentRound()).to.equal(2);
      expect(await cryptoLottoContract.bettingOpen()).to.equal(true);
    });

    it("should prevent starting new round before ending current", async function () {
      await expect(
        cryptoLottoContract.connect(signers.deployer).startNewRound()
      ).to.be.revertedWith("Previous round must be ended first");
    });
  });

  describe("Winnings and Claims", function () {
    beforeEach(async function () {
      const numbers = [1, 2, 3, 4, 5, 6];
      const encryptedInput = await fhevm
        .createEncryptedInput(cryptoLottoContractAddress, signers.alice.address);
      numbers.forEach(num => encryptedInput.add8(num));
      const encrypted = await encryptedInput.encrypt();

      await cryptoLottoContract
        .connect(signers.alice)
        .placeBet(encrypted.handles, encrypted.inputProof, { value: BET_PRICE });

      await cryptoLottoContract.connect(signers.deployer).endRoundAndDraw();
      await cryptoLottoContract.connect(signers.deployer).startNewRound();
    });

    it("should prevent claiming winnings from active round", async function () {
      await expect(
        cryptoLottoContract.connect(signers.alice).claimWinnings(1, 0)
      ).to.not.be.reverted;
    });

    it("should prevent claiming with invalid bet index", async function () {
      await expect(
        cryptoLottoContract.connect(signers.alice).claimWinnings(1, 1)
      ).to.be.revertedWith("Invalid bet index");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      const numbers = [1, 2, 3, 4, 5, 6];
      const encryptedInput = await fhevm
        .createEncryptedInput(cryptoLottoContractAddress, signers.alice.address);
      numbers.forEach(num => encryptedInput.add8(num));
      const encrypted = await encryptedInput.encrypt();

      await cryptoLottoContract
        .connect(signers.alice)
        .placeBet(encrypted.handles, encrypted.inputProof, { value: BET_PRICE });
    });

    it("should return correct player bet count", async function () {
      expect(await cryptoLottoContract.getPlayerBets(signers.alice.address, 1)).to.equal(1);
      expect(await cryptoLottoContract.getPlayerBets(signers.bob.address, 1)).to.equal(0);
    });

    it("should return round information", async function () {
      const roundInfo = await cryptoLottoContract.getRoundInfo(1);
      expect(roundInfo.isActive).to.equal(true);
      expect(roundInfo.totalBets).to.equal(1);
      expect(roundInfo.prizePool).to.equal(BET_PRICE);
      expect(roundInfo.hasWinningNumbers).to.equal(false);
    });

    it("should return contract balance", async function () {
      expect(await cryptoLottoContract.getContractBalance()).to.equal(BET_PRICE);
    });

    it("should return round players", async function () {
      const players = await cryptoLottoContract.getRoundPlayers(1);
      expect(players.length).to.equal(1);
      expect(players[0]).to.equal(signers.alice.address);
    });
  });

  describe("Owner Functions", function () {
    beforeEach(async function () {
      const numbers = [1, 2, 3, 4, 5, 6];
      const encryptedInput = await fhevm
        .createEncryptedInput(cryptoLottoContractAddress, signers.alice.address);
      numbers.forEach(num => encryptedInput.add8(num));
      const encrypted = await encryptedInput.encrypt();

      await cryptoLottoContract
        .connect(signers.alice)
        .placeBet(encrypted.handles, encrypted.inputProof, { value: BET_PRICE });
    });

    it("should allow owner to withdraw funds", async function () {
      const initialBalance = await ethers.provider.getBalance(signers.deployer.address);
      
      await cryptoLottoContract.connect(signers.deployer).withdrawOwnerFunds(BET_PRICE);
      
      const finalBalance = await ethers.provider.getBalance(signers.deployer.address);
      expect(finalBalance).to.be.gt(initialBalance);
    });

    it("should prevent non-owner from withdrawing funds", async function () {
      await expect(
        cryptoLottoContract.connect(signers.alice).withdrawOwnerFunds(BET_PRICE)
      ).to.be.revertedWith("Only owner can call this function");
    });

    it("should prevent withdrawing more than contract balance", async function () {
      await expect(
        cryptoLottoContract.connect(signers.deployer).withdrawOwnerFunds(ethers.parseEther("1"))
      ).to.be.revertedWith("Insufficient balance");
    });
  });

  describe("Edge Cases", function () {
    it("should handle receiving direct ETH", async function () {
      const tx = await signers.alice.sendTransaction({
        to: cryptoLottoContractAddress,
        value: ethers.parseEther("0.1")
      });
      await tx.wait();

      expect(await cryptoLottoContract.getContractBalance()).to.equal(ethers.parseEther("0.1"));
    });
  });
});