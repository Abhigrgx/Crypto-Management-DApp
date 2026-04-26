# CryptoVault - Blockchain-Based Cryptocurrency Management System

CryptoVault is a production-style DApp reference implementation for secure cryptocurrency management across Ethereum and Polygon testnets.

## Core Capabilities

- Store, send, and receive crypto through audited smart-contract flows.
- Multi-signature transfer approvals.
- Daily transaction limits and emergency pause controls.
- Real-time transaction indexing and portfolio analytics.
- Wallet-based authentication using MetaMask signatures and JWT API sessions.
- SIWE (EIP-4361) typed login with rotating refresh token sessions.
- Recurring payments and analytics-focused dashboard UX.

## Monorepo Structure

- `contracts/`: Solidity contracts, Hardhat config, tests, and deployment scripts.
- `backend/`: Express API for auth, indexing, balances, and portfolio aggregation.
- `frontend/`: React/Vite DApp UI with wallet integration and analytics views.
- `docs/`: Architecture, security, API, and testing documentation.

## Architecture

See `docs/architecture.md` for the full explanation and diagram.

## Smart Contract Highlights

Main contract: `contracts/contracts/CryptoVault.sol`

- Role-based access control (`DEFAULT_ADMIN_ROLE`, `OPERATOR_ROLE`).
- Multi-signer management with configurable approval threshold.
- Transaction request/approval/execution lifecycle for ETH and ERC-20.
- Daily limit policy enforcement per signer.
- Emergency pause (circuit breaker).
- Recurring payment scheduler executed by operator role.
- Reentrancy protection and exhaustive event logging.

Security patterns used:

- `ReentrancyGuard`
- `Pausable`
- `AccessControl`
- Custom errors for gas-efficient, explicit failure paths
- Input validation on addresses, amounts, and policy settings

## Backend API Highlights

Base path: `/api`

- `POST /auth/siwe/nonce`: Issues SIWE nonce and typed message.
- `POST /auth/siwe/verify`: Verifies SIWE signature and returns access + refresh tokens.
- `POST /auth/refresh`: Rotates refresh token and returns next access + refresh pair.
- `POST /auth/logout`: Revokes refresh session.
- `GET /wallet/:address/balances`: Native balance by network.
- `GET /wallet/:address/transactions`: Indexed history from vault events.
- `GET /portfolio/:address`: Portfolio aggregation with price enrichment.

Backend protections:

- JWT authentication middleware.
- Wallet ownership authorization for protected address routes.
- Expiring nonce challenge flow for signature replay resistance.
- Refresh token rotation with secret rollover support.
- Input validation via `zod`.

## Frontend Highlights

- MetaMask connect and account state handling.
- Network switching between Sepolia and Polygon Amoy.
- Realtime dashboard updates from backend websocket event stream.
- Dashboard with:
	- Balance overview
	- Transaction history
	- Portfolio distribution chart
	- Send panel (creates multisig request)
	- Receive panel with QR code

## Advanced Features Included

- Multi-signature transaction approval system.
- Smart contract-based recurring payments.
- Analytics dashboard with spending and value indicators.
- Security audit checklist and threat model documents.
- Export-ready API data for CSV/PDF generation (endpoint payloads are structured for export tooling).

## Quick Start

### 1. Install Dependencies

From repository root:

```bash
npm install
```

### 2. Configure Environment

```bash
cp contracts/.env.example contracts/.env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Update values:

- `contracts/.env`: deployer private key + RPC URLs + explorer keys.
- `backend/.env`: JWT secret, RPC URLs, deployed vault address.
- `frontend/.env`: backend API URL + deployed vault address.

### 3. Compile and Test Smart Contracts

```bash
npm --workspace contracts run compile
npm --workspace contracts run test
```

### 4. Deploy Smart Contract

```bash
npm --workspace contracts run deploy:sepolia
# or
npm --workspace contracts run deploy:amoy
```

### 5. Run Backend

```bash
npm --workspace backend run dev
```

### 6. Run Frontend

```bash
npm --workspace frontend run dev
```

## Testing

Current automated tests are in `contracts/test/CryptoVault.test.js` and validate:

- Multisig request lifecycle.
- Daily limit enforcement.
- Emergency pause behavior.
- Unauthorized transfer attempts.
- Recurring payment execution.
- ERC-20 transaction path.

See `docs/testing-strategy.md` for expanded integration and security test plans.

Additional integration tests:

- Backend Supertest + Vitest: `backend/test/auth.integration.test.js`
- Frontend Playwright: `frontend/tests/e2e/auth-dashboard.spec.js`

CI workflows:

- Main CI: `.github/workflows/ci.yml`
- CodeQL security scan: `.github/workflows/codeql.yml`

## Security and Threat Model

- Threat model and controls: `docs/security-threat-model.md`
- Contract audit checklist: `docs/audit-checklist.md`

## Clean Architecture Decisions

- On-chain for settlement-critical business rules.
- Off-chain for analytics and indexing workloads.
- Frontend focuses on user workflow orchestration and trust cues.
- Strict module boundaries to simplify upgrades and incident response.

## Scalability Notes

- Event-based indexing is cache-backed and chain-specific.
- Polygon Amoy path reduces fee overhead during high-volume simulations.
- Multichain provider abstraction allows expansion to additional EVM networks.

## Future Production Enhancements

- Secure refresh tokens in HttpOnly cookies with CSRF protection.
- Websocket indexer for near real-time subscriptions.
- Alerting pipeline to Slack/PagerDuty.
- DEX route integration for token swaps.
- AI-assisted fraud scoring on off-chain behavior signals.