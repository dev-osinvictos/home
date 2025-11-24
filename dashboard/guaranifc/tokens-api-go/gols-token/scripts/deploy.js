import hre from "hardhat";

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("🚀 Deploying with:", deployer.address);

  const GOLS = await hre.ethers.getContractFactory("GOLS");
  const contract = await GOLS.deploy(1_000_000n * 10n ** 18n);

  await contract.waitForDeployment();
  console.log("🏁 GOLS deployed at:", contract.target);
}

main().catch(console.error);
