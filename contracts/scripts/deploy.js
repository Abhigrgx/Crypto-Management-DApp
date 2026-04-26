const hre = require("hardhat");

async function main() {
  const [deployer, signer1, signer2] = await hre.ethers.getSigners();

  const CryptoVault = await hre.ethers.getContractFactory("CryptoVault");
  const vault = await CryptoVault.deploy([deployer.address, signer1.address, signer2.address], 2);
  await vault.waitForDeployment();

  console.log("CryptoVault deployed to:", await vault.getAddress());
  console.log("Deployer:", deployer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
