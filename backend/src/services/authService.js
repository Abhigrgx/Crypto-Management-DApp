import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { SiweMessage } from "siwe";
import { ethers } from "ethers";
import { env } from "../config/env.js";

const nonceStore = new Map();
const refreshSessions = new Map();

function createNonce() {
  return crypto.randomBytes(16).toString("hex");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getRefreshSecrets() {
  return env.JWT_REFRESH_SECRETS.split(",")
    .map((secret) => secret.trim())
    .filter(Boolean);
}

function getPrimaryRefreshSecret() {
  const secrets = getRefreshSecrets();
  if (secrets.length === 0) {
    throw new Error("Missing refresh token signing secret");
  }
  return secrets[0];
}

function verifyRefreshJwt(refreshToken) {
  const secrets = getRefreshSecrets();

  for (const secret of secrets) {
    try {
      return jwt.verify(refreshToken, secret);
    } catch (_error) {
      // Try previous rotated secret.
    }
  }

  throw new Error("Invalid refresh token signature");
}

function issueAccessToken(wallet) {
  return jwt.sign(
    {
      sub: wallet,
      wallet,
      roles: ["user"]
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES
    }
  );
}

function issueRefreshToken(wallet, previousJti = null) {
  const jti = crypto.randomUUID();

  const refreshToken = jwt.sign(
    {
      sub: wallet,
      wallet,
      type: "refresh",
      jti,
      previousJti
    },
    getPrimaryRefreshSecret(),
    {
      expiresIn: env.JWT_REFRESH_EXPIRES
    }
  );

  const decoded = jwt.decode(refreshToken);

  refreshSessions.set(jti, {
    wallet,
    tokenHash: sha256(refreshToken),
    revoked: false,
    expiresAt: decoded.exp * 1000
  });

  return refreshToken;
}

function issueTokenPair(wallet, previousJti = null) {
  return {
    accessToken: issueAccessToken(wallet),
    refreshToken: issueRefreshToken(wallet, previousJti)
  };
}

function revokeSession(jti) {
  const session = refreshSessions.get(jti);
  if (session) {
    session.revoked = true;
  }
}

export function issueSiweNonce(address, chainId) {
  const normalizedAddress = ethers.getAddress(address);
  const nonce = createNonce();

  nonceStore.set(normalizedAddress, {
    nonce,
    createdAt: Date.now(),
    chainId: Number(chainId || 1)
  });

  return nonce;
}

export function buildSiweMessage({ address, chainId, nonce, domain }) {
  const normalizedAddress = ethers.getAddress(address);

  const siweMessage = new SiweMessage({
    domain,
    address: normalizedAddress,
    statement: env.SIWE_STATEMENT,
    uri: env.SIWE_URI,
    version: "1",
    chainId: Number(chainId || 1),
    nonce
  });

  return siweMessage.prepareMessage();
}

export async function verifySiweLogin(message, signature) {
  const siweMessage = new SiweMessage(message);
  const normalizedAddress = ethers.getAddress(siweMessage.address);
  const nonceRecord = nonceStore.get(normalizedAddress);

  if (!nonceRecord) {
    throw new Error("Nonce not found. Request a new SIWE message.");
  }

  if (Date.now() - nonceRecord.createdAt > 5 * 60 * 1000) {
    nonceStore.delete(normalizedAddress);
    throw new Error("Nonce expired. Request a new SIWE message.");
  }

  if (Number(siweMessage.chainId) !== nonceRecord.chainId) {
    throw new Error("SIWE chain mismatch.");
  }

  await siweMessage.verify({
    signature,
    nonce: nonceRecord.nonce
  });

  nonceStore.delete(normalizedAddress);

  return issueTokenPair(normalizedAddress);
}

export function rotateRefreshToken(refreshToken) {
  const payload = verifyRefreshJwt(refreshToken);

  if (payload.type !== "refresh" || !payload.jti || !payload.wallet) {
    throw new Error("Malformed refresh token");
  }

  const normalizedAddress = ethers.getAddress(payload.wallet);
  const session = refreshSessions.get(payload.jti);

  if (!session || session.revoked) {
    throw new Error("Refresh token revoked");
  }

  if (session.expiresAt < Date.now()) {
    throw new Error("Refresh token expired");
  }

  if (session.tokenHash !== sha256(refreshToken)) {
    throw new Error("Refresh token replay detected");
  }

  revokeSession(payload.jti);

  return issueTokenPair(normalizedAddress, payload.jti);
}

export function revokeRefreshToken(refreshToken) {
  const payload = verifyRefreshJwt(refreshToken);

  if (!payload.jti) {
    throw new Error("Malformed refresh token");
  }

  revokeSession(payload.jti);
}
