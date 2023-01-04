import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("HTLC", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployHTLCFixture() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60;
    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS;

    // Contracts are deployed using the first signer/account by default
    const [alice, bob] = await ethers.getSigners();

    const HTLC = await ethers.getContractFactory("HTLC");
    const htlc = await HTLC.deploy();

    const TestToken = await ethers.getContractFactory("TestToken");
    const testToken = await TestToken.deploy(100);
    await testToken.connect(alice).approve(htlc.address, 100);
    await testToken.connect(bob).approve(htlc.address, 100);

    const preImage = "0xffffff";
    const hashValue = ethers.utils.sha256(preImage);

    return { htlc, testToken, alice, bob, preImage, hashValue, unlockTime };
  }

  describe("Locking", function () {
    it("Should revert with zero value", async function () {
      const { htlc, testToken, alice, bob, hashValue } = await loadFixture(deployHTLCFixture);

      await expect(htlc.connect(alice).lock(hashValue, 1, 0, testToken.address, bob.address)).to.be.revertedWith(
        "HTLC: cannot lock zero tokens"
      );
    });

    it("Should revert if locker does not have enough tokens", async function () {
      const { htlc, testToken, alice, bob, hashValue } = await loadFixture(
        deployHTLCFixture
      );

      await expect(htlc.connect(bob).lock(hashValue, 1, 1, testToken.address, alice.address)).to.be.revertedWith(
        "ERC20: transfer amount exceeds balance"
      );
    });

    it("Should not allowing locking twice with the same hash", async function () {
      const { htlc, testToken, alice, bob, hashValue } = await loadFixture(
        deployHTLCFixture
      );

      await htlc.connect(alice).lock(hashValue, 1, 1, testToken.address, bob.address);

      await expect(htlc.connect(alice).lock(hashValue, 1, 1, testToken.address, bob.address)).to.be.revertedWith(
        "HTLC: lock cannot already exist for the same hash value"
      );
    });
  });

  describe("Claiming", function () {
    it("Not allow claiming after the unlock time", async function () {
      const { htlc, testToken, alice, bob, preImage, hashValue, unlockTime } = await loadFixture(
        deployHTLCFixture
      );
      const lockedAmount = 1;

      await htlc.connect(alice).lock(hashValue, unlockTime, lockedAmount, testToken.address, bob.address);

      await time.increaseTo(unlockTime);

      await expect(htlc.connect(bob).claim(preImage)).to.be.revertedWith(
        "HTLC: can only claim before the unlock time"
      );
    });

    it("Not allow other account to claim", async function () {
      const { htlc, testToken, alice, bob, preImage, hashValue, unlockTime } = await loadFixture(
        deployHTLCFixture
      );
      const lockedAmount = 1;

      await htlc.connect(alice).lock(hashValue, unlockTime, lockedAmount, testToken.address, bob.address);

      await expect(htlc.connect(alice).claim(preImage)).to.be.revertedWith(
        "HTLC: only the receiver can claim"
      );
    });

    it("Revert if invalid pre-image is provided", async function () {
      const { htlc, testToken, alice, bob, preImage, hashValue, unlockTime } = await loadFixture(
        deployHTLCFixture
      );
      const lockedAmount = 1;

      await htlc.connect(alice).lock(hashValue, unlockTime, lockedAmount, testToken.address, bob.address);

      await expect(htlc.connect(bob).claim(preImage + "AA")).to.be.revertedWith(
        "HTLC: not a valid pre-image for any hash"
      );
    });

    it("Should transfer the funds to the recipient if correct pre-image is provided", async function () {
      const { htlc, testToken, alice, bob, preImage, hashValue, unlockTime } = await loadFixture(
        deployHTLCFixture
      );
      const lockedAmount = 1;

      await htlc.connect(alice).lock(hashValue, unlockTime, lockedAmount, testToken.address, bob.address);

      await expect(htlc.connect(bob).claim(preImage)).to.changeTokenBalances(
        testToken,
        [bob, htlc],
        [lockedAmount, -lockedAmount]
      );
    });
  });

  describe("Unlocking", function () {
    it("Should not allow unlocking before the time window has elapsed", async function () {
      const { htlc, testToken, alice, bob, hashValue, unlockTime } = await loadFixture(
        deployHTLCFixture
      );
      const lockedAmount = 1;

      await htlc.connect(alice).lock(hashValue, unlockTime, lockedAmount, testToken.address, bob.address);

      await expect(htlc.connect(alice).unlock(hashValue)).to.be.revertedWith(
        "HTLC: can only unlock on or after the unlock time"
      );
    });

    it("Should not allow other account to unlock", async function () {
      const { htlc, testToken, alice, bob, hashValue, unlockTime } = await loadFixture(
        deployHTLCFixture
      );
      const lockedAmount = 1;

      await htlc.connect(alice).lock(hashValue, unlockTime, lockedAmount, testToken.address, bob.address);

      await time.increaseTo(unlockTime);

      await expect(htlc.connect(bob).unlock(hashValue)).to.be.revertedWith(
        "HTLC: only the sender can unlock"
      );
    });

    it("Should transfer the funds back to the sender after the time window has elapsed", async function () {
      const { htlc, testToken, alice, bob, hashValue, unlockTime } = await loadFixture(
        deployHTLCFixture
      );
      const lockedAmount = 1;

      await htlc.connect(alice).lock(hashValue, unlockTime, lockedAmount, testToken.address, bob.address);

      await time.increaseTo(unlockTime);

      await expect(htlc.connect(alice).unlock(hashValue)).to.changeTokenBalances(
        testToken,
        [alice, htlc],
        [lockedAmount, -lockedAmount]
      );
    });
  });
});
