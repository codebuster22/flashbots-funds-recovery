// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {TransparentUpgradeableProxy, ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {ERC20NonTransferable} from "../src/ERC20NonTransferable.sol";
import {ERC20Transferable} from "../src/ERC20Transferable.sol";

contract DeployScript is Script {
    ERC20NonTransferable public token;
    address public treasury;

    function setUp() public {
        treasury = vm.envAddress("TREASURY");
    }

    function run() public returns (TransparentUpgradeableProxy) {
        vm.startBroadcast();
        // deploy implementation
        token = new ERC20NonTransferable();

        bytes memory data = abi.encodeWithSelector(
            ERC20NonTransferable.initialize.selector,
            treasury
        );

        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(address(token), treasury, data);

        vm.stopBroadcast();

        return proxy;
    }
}

contract LogUpgradeData is Script {
    address public proxy;

    function setUp() public {
        proxy = vm.envAddress("PROXY");
    }

    function run() public returns (bytes memory) {
        vm.startBroadcast();
        ERC20Transferable newImplementation = new ERC20Transferable();
        vm.stopBroadcast();
        bytes memory data = abi.encodeWithSelector(
            ProxyAdmin.upgradeAndCall.selector,
            proxy,
            address(newImplementation),
            ""
        );
        return data;
    }
}

