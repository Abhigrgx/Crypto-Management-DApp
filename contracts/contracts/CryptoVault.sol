// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CryptoVault is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    error NotSigner();
    error InvalidAddress();
    error InvalidAmount();
    error InvalidApprovals();
    error TxNotFound();
    error AlreadyExecuted();
    error NotEnoughApprovals();
    error AlreadyApproved();
    error NotApproved();
    error DailyLimitExceeded();
    error RecurringNotDue();

    struct UserPolicy {
        uint256 dailyLimit;
        uint256 spentToday;
        uint256 lastDay;
    }

    struct TxRequest {
        address proposer;
        address to;
        address token;
        uint256 amount;
        bytes data;
        uint256 confirmations;
        bool executed;
        uint64 createdAt;
    }

    struct RecurringPayment {
        address payer;
        address to;
        address token;
        uint256 amount;
        uint256 interval;
        uint64 nextExecution;
        bool active;
    }

    mapping(address => bool) public isSigner;
    mapping(address => UserPolicy) public policies;
    mapping(uint256 => TxRequest) public txRequests;
    mapping(uint256 => mapping(address => bool)) public approvals;
    mapping(uint256 => RecurringPayment) public recurringPayments;

    address[] public signers;
    uint256 public minApprovals;
    uint256 public txCount;
    uint256 public recurringCount;

    event Deposit(address indexed from, address indexed token, uint256 amount);
    event TxRequested(
        uint256 indexed txId,
        address indexed proposer,
        address indexed to,
        address token,
        uint256 amount
    );
    event TxApproved(uint256 indexed txId, address indexed signer);
    event TxRevoked(uint256 indexed txId, address indexed signer);
    event TxExecuted(uint256 indexed txId, address indexed executor);
    event SignerAdded(address indexed signer);
    event SignerRemoved(address indexed signer);
    event MinApprovalsUpdated(uint256 newMinApprovals);
    event DailyLimitUpdated(address indexed user, uint256 newLimit);
    event RecurringCreated(
        uint256 indexed recurringId,
        address indexed payer,
        address indexed to,
        address token,
        uint256 amount,
        uint256 interval
    );
    event RecurringExecuted(uint256 indexed recurringId, uint64 nextExecution);
    event RecurringCancelled(uint256 indexed recurringId);

    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner();
        _;
    }

    constructor(address[] memory initialSigners, uint256 minApprovals_) {
        if (initialSigners.length == 0) revert InvalidApprovals();
        if (minApprovals_ == 0 || minApprovals_ > initialSigners.length) revert InvalidApprovals();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);

        uint256 length = initialSigners.length;
        for (uint256 i = 0; i < length; ) {
            address signer = initialSigners[i];
            if (signer == address(0) || isSigner[signer]) revert InvalidAddress();
            isSigner[signer] = true;
            signers.push(signer);
            emit SignerAdded(signer);
            unchecked {
                ++i;
            }
        }

        minApprovals = minApprovals_;
    }

    receive() external payable {
        emit Deposit(msg.sender, address(0), msg.value);
    }

    function depositToken(address token, uint256 amount) external whenNotPaused {
        if (token == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, token, amount);
    }

    function createTxRequest(
        address to,
        address token,
        uint256 amount,
        bytes calldata data
    ) external whenNotPaused onlySigner returns (uint256 txId) {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0) revert InvalidAmount();

        _consumeDailyLimit(msg.sender, amount);

        txId = txCount;
        txRequests[txId] = TxRequest({
            proposer: msg.sender,
            to: to,
            token: token,
            amount: amount,
            data: data,
            confirmations: 0,
            executed: false,
            createdAt: uint64(block.timestamp)
        });

        unchecked {
            ++txCount;
        }

        emit TxRequested(txId, msg.sender, to, token, amount);
    }

    function approveTx(uint256 txId) external onlySigner whenNotPaused {
        TxRequest storage request = txRequests[txId];
        if (request.to == address(0)) revert TxNotFound();
        if (request.executed) revert AlreadyExecuted();
        if (approvals[txId][msg.sender]) revert AlreadyApproved();

        approvals[txId][msg.sender] = true;
        unchecked {
            ++request.confirmations;
        }

        emit TxApproved(txId, msg.sender);
    }

    function revokeApproval(uint256 txId) external onlySigner whenNotPaused {
        TxRequest storage request = txRequests[txId];
        if (request.to == address(0)) revert TxNotFound();
        if (request.executed) revert AlreadyExecuted();
        if (!approvals[txId][msg.sender]) revert NotApproved();

        approvals[txId][msg.sender] = false;
        unchecked {
            --request.confirmations;
        }

        emit TxRevoked(txId, msg.sender);
    }

    function executeTx(uint256 txId) external nonReentrant onlySigner whenNotPaused {
        TxRequest storage request = txRequests[txId];
        if (request.to == address(0)) revert TxNotFound();
        if (request.executed) revert AlreadyExecuted();
        if (request.confirmations < minApprovals) revert NotEnoughApprovals();

        request.executed = true;

        if (request.token == address(0)) {
            (bool success, ) = request.to.call{value: request.amount}(request.data);
            require(success, "ETH_TRANSFER_FAILED");
        } else {
            if (request.data.length == 0) {
                IERC20(request.token).safeTransfer(request.to, request.amount);
            } else {
                // Allow encoded low-level token interaction for advanced workflows.
                (bool success, ) = request.token.call(request.data);
                require(success, "TOKEN_CALL_FAILED");
            }
        }

        emit TxExecuted(txId, msg.sender);
    }

    function createRecurringPayment(
        address to,
        address token,
        uint256 amount,
        uint256 interval
    ) external onlySigner whenNotPaused returns (uint256 recurringId) {
        if (to == address(0)) revert InvalidAddress();
        if (amount == 0 || interval == 0) revert InvalidAmount();

        recurringId = recurringCount;
        recurringPayments[recurringId] = RecurringPayment({
            payer: msg.sender,
            to: to,
            token: token,
            amount: amount,
            interval: interval,
            nextExecution: uint64(block.timestamp + interval),
            active: true
        });

        unchecked {
            ++recurringCount;
        }

        emit RecurringCreated(recurringId, msg.sender, to, token, amount, interval);
    }

    function executeRecurringPayment(uint256 recurringId) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant {
        RecurringPayment storage payment = recurringPayments[recurringId];
        if (!payment.active) revert TxNotFound();
        if (block.timestamp < payment.nextExecution) revert RecurringNotDue();

        _consumeDailyLimit(payment.payer, payment.amount);

        if (payment.token == address(0)) {
            (bool success, ) = payment.to.call{value: payment.amount}("");
            require(success, "RECURRING_ETH_FAILED");
        } else {
            IERC20(payment.token).safeTransfer(payment.to, payment.amount);
        }

        payment.nextExecution = uint64(block.timestamp + payment.interval);
        emit RecurringExecuted(recurringId, payment.nextExecution);
    }

    function cancelRecurringPayment(uint256 recurringId) external {
        RecurringPayment storage payment = recurringPayments[recurringId];
        if (!payment.active) revert TxNotFound();
        if (
            msg.sender != payment.payer &&
            !hasRole(DEFAULT_ADMIN_ROLE, msg.sender) &&
            !hasRole(OPERATOR_ROLE, msg.sender)
        ) revert NotSigner();

        payment.active = false;
        emit RecurringCancelled(recurringId);
    }

    function addSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (signer == address(0) || isSigner[signer]) revert InvalidAddress();
        isSigner[signer] = true;
        signers.push(signer);
        emit SignerAdded(signer);
    }

    function removeSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!isSigner[signer]) revert NotSigner();
        if (signers.length <= minApprovals) revert InvalidApprovals();

        isSigner[signer] = false;
        uint256 length = signers.length;
        for (uint256 i = 0; i < length; ) {
            if (signers[i] == signer) {
                signers[i] = signers[length - 1];
                signers.pop();
                break;
            }
            unchecked {
                ++i;
            }
        }

        if (minApprovals > signers.length) {
            minApprovals = signers.length;
            emit MinApprovalsUpdated(minApprovals);
        }

        emit SignerRemoved(signer);
    }

    function setMinApprovals(uint256 newMinApprovals) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (newMinApprovals == 0 || newMinApprovals > signers.length) revert InvalidApprovals();
        minApprovals = newMinApprovals;
        emit MinApprovalsUpdated(newMinApprovals);
    }

    function setDailyLimit(address user, uint256 newLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (user == address(0)) revert InvalidAddress();
        policies[user].dailyLimit = newLimit;
        emit DailyLimitUpdated(user, newLimit);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function getSigners() external view returns (address[] memory) {
        return signers;
    }

    function _consumeDailyLimit(address user, uint256 amount) internal {
        UserPolicy storage policy = policies[user];
        if (policy.dailyLimit == 0) {
            return;
        }

        uint256 day = block.timestamp / 1 days;
        if (policy.lastDay != day) {
            policy.lastDay = day;
            policy.spentToday = 0;
        }

        uint256 updatedSpent = policy.spentToday + amount;
        if (updatedSpent > policy.dailyLimit) revert DailyLimitExceeded();
        policy.spentToday = updatedSpent;
    }
}
