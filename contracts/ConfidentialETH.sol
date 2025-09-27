// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.24;

import {ConfidentialFungibleToken} from "new-confidential-contracts/token/ConfidentialFungibleToken.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {FHE, euint64} from "@fhevm/solidity/lib/FHE.sol";

contract ConfidentialETH is ConfidentialFungibleToken, SepoliaConfig {
    address owner;
    address lottoAddress;

    constructor(address _owner) ConfidentialFungibleToken("cETH", "cETH", "") {
        owner = _owner;
    }

    function setLottoAddress(address _lotto) external {
        require(msg.sender == owner, "not owner");
        lottoAddress = _lotto;
    }

    function mint(address to, euint64 amount) external {
        require(msg.sender == lottoAddress, "not lotto");
        _mint(to, amount);
    }
}
