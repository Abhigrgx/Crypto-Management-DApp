# Backend API Structure

Base URL: `/api`

## Auth

- `POST /auth/siwe/nonce`
  - Body: `{ "address": "0x...", "chainId": 11155111 }`
  - Returns typed SIWE message + nonce.
- `POST /auth/siwe/verify`
  - Body: `{ "message": "SIWE message", "signature": "0x..." }`
  - Returns `{ accessToken, refreshToken }`.
- `POST /auth/refresh`
  - Body: `{ "refreshToken": "..." }`
  - Rotates refresh token and returns a new token pair.
- `POST /auth/logout`
  - Body: `{ "refreshToken": "..." }`
  - Revokes active refresh session.

## Wallet (JWT required)

- `GET /wallet/:address/balances?chain=ethereum|polygon`
- `GET /wallet/:address/transactions?chain=ethereum|polygon`

## Portfolio (JWT required)

- `GET /portfolio/:address?chain=ethereum|polygon&tokens=0xToken1,0xToken2`
