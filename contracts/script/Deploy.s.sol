// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {GavleGoatMarket, IERC20} from "../src/GavleGoatMarket.sol";

/**
 * @notice Deploys one GavleGoatMarket.
 *
 * All inputs come from the environment so no secret ever appears on a command
 * line. `vm.startBroadcast(privateKey)` signs locally in the script, so forge
 * never needs a `--private-key` flag.
 *
 *   DEPLOYER_PRIVATE_KEY  0x...  (throwaway key on testnet, hardware wallet on mainnet)
 *   USDC_ADDRESS          0x...  (Base Sepolia: 0x036CbD53842c5426634e7929541eC2318f3dCF7e)
 *   RESOLVER_ADDRESS      0x...  (a Safe — never an EOA holding positions)
 *   BETTING_CLOSES_AT     uint64 (unix seconds, 2027-01-01 00:00 CET = 1798758000)
 *   RESOLUTION_DEADLINE   uint64 (unix seconds, 2027-01-31 00:00 CET = 1801350000)
 */
contract Deploy is Script {
    function run() external returns (GavleGoatMarket market) {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address resolver = vm.envAddress("RESOLVER_ADDRESS");
        uint64 closesAt = uint64(vm.envUint("BETTING_CLOSES_AT"));
        uint64 deadline = uint64(vm.envUint("RESOLUTION_DEADLINE"));

        require(closesAt > block.timestamp, "BETTING_CLOSES_AT is in the past");

        console.log("deployer      ", vm.addr(pk));
        console.log("usdc          ", usdc);
        console.log("resolver      ", resolver);
        console.log("closes at     ", closesAt);
        console.log("void after    ", deadline + 30 days);

        vm.startBroadcast(pk);
        market = new GavleGoatMarket(IERC20(usdc), resolver, closesAt, deadline);
        vm.stopBroadcast();

        console.log("");
        console.log("GavleGoatMarket deployed at:", address(market));
        console.log("solvencyGap()               ", market.solvencyGap());
    }
}
