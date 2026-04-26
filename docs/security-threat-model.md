# Security Analysis and Threat Model

## Assets

- Vault balances (ETH and ERC-20).
- Multisig signer authority.
- JWT authentication tokens.
- Off-chain portfolio and transaction metadata.

## Threats and Controls

- Reentrancy during transfer execution.
  - Control: `nonReentrant` on execution functions.
- Unauthorized transaction proposal or execution.
  - Control: `onlySigner` and role checks (`DEFAULT_ADMIN_ROLE`, `OPERATOR_ROLE`).
- Privilege abuse by compromised admin.
  - Control: multisig governance for admin EOA, pausable breaker, auditable events.
- Signature replay for backend auth.
  - Control: one-time nonce with 5-minute TTL and nonce invalidation after use.
- API token theft.
  - Control: short JWT lifetime and strict bearer validation.
- Frontend phishing imitation.
  - Control: explicit signed message prefix and wallet-address binding in login message.

## Additional Hardening Recommendations

- Add domain allowlist and persistent nonce store for SIWE verification.
- Add IP rate limiting and WAF in front of backend APIs.
- Add OpenZeppelin Defender autotasks for emergency pause policy.
- Add on-chain invariant monitoring (e.g., abnormal outflow velocity alerts).
- Add formal verification for critical payout constraints.
