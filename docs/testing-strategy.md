# Testing Strategy

## Smart Contract Tests

Coverage areas implemented in Hardhat tests:

- Multisig flow: request -> approvals -> execution.
- Daily limit enforcement.
- Emergency pause behavior.
- Unauthorized signer restrictions.
- Recurring payment execution by operator role.
- ERC-20 transfers through the vault.

## Integration Tests (Recommended)

- Backend + local Hardhat node for full auth to history flow.
- Frontend + mocked MetaMask provider + backend test server.
- Network switching tests (Sepolia <-> Amoy).

## Attack Simulations

- Unauthorized transfer attempts by non-signers.
- Replay of used nonces in auth flow.
- Phishing message mismatch test (signature from altered message should fail).

## Example Test Cases

1. Should reject execution when approvals < threshold.
2. Should reject `createTxRequest` when user exceeds daily limit.
3. Should block all state mutations while contract is paused.
4. Should reject API reads when JWT wallet does not match route wallet.
5. Should return indexed history sorted descending by block number.
