import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Deploy ConfidentialETH first
  const deployedCeth = await deploy("ConfidentialETH", {
    from: deployer,
    log: true,
    args: [deployer],
    skipIfAlreadyDeployed: false,
  });

  // Deploy CryptoLotto with cETH address
  const deployedCryptoLotto = await deploy("CryptoLotto", {
    from: deployer,
    log: true,
    args: [deployedCeth.address],
    skipIfAlreadyDeployed: false,
  });

  // Wire lotto minter in cETH
  const c = await hre.ethers.getContractAt("ConfidentialETH", deployedCeth.address);
  const current = await c.getAddress();
  await (await c.setLottoAddress(deployedCryptoLotto.address)).wait();

  console.log(`ConfidentialETH: ${deployedCeth.address}`);
  console.log(`CryptoLotto: ${deployedCryptoLotto.address}`);
};
export default func;
func.id = "deploy_contracts"; // id required to prevent reexecution
func.tags = ["FHECounter", "CryptoLotto"];
