import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

import { CryptoLotto, CryptoLotto__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

describe("CryptoLotto", function () {
  let signers: Signers;
  let lotto: CryptoLotto;
  let lottoAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    const factory = (await ethers.getContractFactory("CryptoLotto")) as CryptoLotto__factory;
    lotto = (await factory.deploy()) as CryptoLotto;
    lottoAddress = await lotto.getAddress();
  });

  it("allows buying a ticket and computing encrypted match count", async function () {
    const currentRound = await lotto.getCurrentRoundId();

    const input = await fhevm
      .createEncryptedInput(lottoAddress, signers.alice.address)
      .add8(1)
      .add8(2)
      .add8(3)
      .add8(4)
      .encrypt();

    const price = await lotto.TICKET_PRICE();
    await expect(
      lotto
        .connect(signers.alice)
        .buyTicket(input.handles[0], input.handles[1], input.handles[2], input.handles[3], input.inputProof, {
          value: price,
        }),
    ).to.emit(lotto, "TicketPurchased");

    await lotto.connect(signers.alice).testComputeMatchCount(currentRound, 0, 1, 2, 0, 0);
    const h = await lotto.getTestLastMatch();
    const clearMatches = await fhevm.userDecryptEuint(
      FhevmType.euint8,
      h as any,
      lottoAddress,
      signers.alice,
    );
    expect(clearMatches).to.eq(2); // 1 & 2 match in the right place
  });
});
