// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract HTLC {
    struct Lock {
        uint unlockTime;
        uint amount;
        address tokenAddress;
        address senderAddress;
        address receiverAddress;
    }

    mapping(bytes32 => Lock) public locks;

    event Claimed(
        bytes preImage,
        bytes32 hashValue,
        uint when,
        uint amount,
        address tokenAddress,
        address senderAddress,
        address receiverAddress
    );

    event Locked(
        bytes32 hashValue,
        uint when,
        uint amount,
        address tokenAddress,
        address senderAddress,
        address receiverAddress
    );

    event Retaken(
        bytes32 hashValue,
        uint when,
        uint amount,
        address tokenAddress,
        address senderAddress,
        address receiverAddress
    );

    function claim(bytes calldata preImage) external {
        bytes32 hashValue = keccak256(preImage);
        Lock storage l = locks[hashValue];
        uint amount = l.amount;
        require(amount > 0, "HTLC: not a valid pre-image for any hash");

        require(block.timestamp < l.unlockTime, "HTLC: can only claim before the unlock time");
        address receiverAddress = l.receiverAddress;
        require(msg.sender == receiverAddress, "HTLC: only the receiver can claim");

        IERC20 erc20 = IERC20(l.tokenAddress);
        delete locks[hashValue];
        require(erc20.transfer(receiverAddress, amount), "HTLC: erc20 transfer must be successful");

        emit Claimed({
            preImage: preImage,
            hashValue: hashValue,
            amount: l.amount,
            when: block.timestamp,
            tokenAddress: l.tokenAddress,
            senderAddress: l.senderAddress,
            receiverAddress: l.receiverAddress
        });
    }

    function lock(bytes32 hashValue, uint unlockTime, uint amount, address tokenAddress, address receiverAddress) external {
        require(locks[hashValue].amount == 0, "HTLC: lock cannot already exist for the same hash value");
        require(amount > 0, "HTLC: cannot lock zero tokens");

        locks[hashValue] = Lock({
            unlockTime: unlockTime,
            amount: amount,
            tokenAddress: tokenAddress,
            senderAddress: msg.sender,
            receiverAddress: receiverAddress
        });

        IERC20 erc20 = IERC20(tokenAddress);

        require(erc20.transferFrom(msg.sender, address(this), amount), "HTLC: erc20 transfer for locking must be successful");
    }

    function retake(bytes32 hashValue) external {
        Lock storage l = locks[hashValue];
        uint amount = l.amount;
        require(amount > 0, "HTLC: no lock exists for the given hash");

        require(block.timestamp >= l.unlockTime, "HTLC: can only retake on or after the unlock time");
        address senderAddress = l.senderAddress;
        require(msg.sender == senderAddress, "HTLC: only the sender can retake");

        IERC20 erc20 = IERC20(l.tokenAddress);
        delete locks[hashValue];
        require(erc20.transfer(senderAddress, amount), "HTLC: erc20 transfer must be successful");

        emit Retaken({
            hashValue: hashValue,
            amount: l.amount,
            when: block.timestamp,
            tokenAddress: l.tokenAddress,
            senderAddress: l.senderAddress,
            receiverAddress: l.receiverAddress
        });
    }
}
