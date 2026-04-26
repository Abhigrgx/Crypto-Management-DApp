const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CryptoVault", function () {
  async function deployFixture() {
    const [admin, signer1, signer2, outsider, recipient] = await ethers.getSigners();

    const CryptoVault = await ethers.getContractFactory("CryptoVault");
    const vault = await CryptoVault.deploy([admin.address, signer1.address, signer2.address], 2);
    await vault.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const token = await MockERC20.deploy("Mock USD", "mUSD");
    await token.waitForDeployment();

    await token.mint(await vault.getAddress(), ethers.parseUnits("1000", 18));

    return { vault, token, admin, signer1, signer2, outsider, recipient };
  }

  it("supports ETH multisig execution", async function () {
    const { vault, signer1, signer2, recipient } = await deployFixture();

    await signer1.sendTransaction({ to: await vault.getAddress(), value: ethers.parseEther("2") });

    await vault.connect(signer1).createTxRequest(recipient.address, ethers.ZeroAddress, ethers.parseEther("1"), "0x");
    await vault.connect(signer1).approveTx(0);
    await vault.connect(signer2).approveTx(0);

    await expect(() => vault.connect(signer2).executeTx(0)).to.changeEtherBalances(
      [vault, recipient],
      [ethers.parseEther("-1"), ethers.parseEther("1")]
    );
  });

  it("enforces daily limits", async function () {
    const { vault, signer1, recipient } = await deployFixture();

    await vault.setDailyLimit(signer1.address, ethers.parseEther("0.5"));
    await vault.connect(signer1).createTxRequest(recipient.address, ethers.ZeroAddress, ethers.parseEther("0.4"), "0x");

    await expect(
      vault.connect(signer1).createTxRequest(recipient.address, ethers.ZeroAddress, ethers.parseEther("0.2"), "0x")
    ).to.be.revertedWithCustomError(vault, "DailyLimitExceeded");
  });

  it("allows admin to pause and block tx creation", async function () {
    const { vault, signer1, recipient } = await deployFixture();

    await vault.pause();

    await expect(
      vault.connect(signer1).createTxRequest(recipient.address, ethers.ZeroAddress, ethers.parseEther("0.1"), "0x")
    ).to.be.revertedWithCustomError(vault, "EnforcedPause");
  });

  it("blocks unauthorized tx actions", async function () {
    const { vault, outsider, recipient } = await deployFixture();

    await expect(
      vault.connect(outsider).createTxRequest(recipient.address, ethers.ZeroAddress, ethers.parseEther("0.1"), "0x")
    ).to.be.revertedWithCustomError(vault, "NotSigner");
  });

  it("executes recurring payment by operator", async function () {
    const { vault, admin, signer1, recipient } = await deployFixture();

    await signer1.sendTransaction({ to: await vault.getAddress(), value: ethers.parseEther("2") });

    await vault.connect(signer1).createRecurringPayment(recipient.address, ethers.ZeroAddress, ethers.parseEther("0.2"), 60);

    await ethers.provider.send("evm_increaseTime", [61]);
    await ethers.provider.send("evm_mine");

    await expect(() => vault.connect(admin).executeRecurringPayment(0)).to.changeEtherBalances(
      [vault, recipient],
      [ethers.parseEther("-0.2"), ethers.parseEther("0.2")]
    );
  });

  it("supports ERC20 transfer execution", async function () {
    const { vault, token, signer1, signer2, recipient } = await deployFixture();

    await vault.connect(signer1).createTxRequest(
      recipient.address,
      await token.getAddress(),
      ethers.parseUnits("25", 18),
      "0x"
    );
    await vault.connect(signer1).approveTx(0);
    await vault.connect(signer2).approveTx(0);

    await vault.connect(signer2).executeTx(0);

    expect(await token.balanceOf(recipient.address)).to.equal(ethers.parseUnits("25", 18));
  });
});
