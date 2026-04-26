import { Router } from "express";
import { z } from "zod";
import {
  buildSiweMessage,
  issueSiweNonce,
  revokeRefreshToken,
  rotateRefreshToken,
  verifySiweLogin
} from "../services/authService.js";

const router = Router();

const siweNonceSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number().int().positive().default(1)
});

const siweVerifySchema = z.object({
  message: z.string().min(10),
  signature: z.string().min(10)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20)
});

router.post("/siwe/nonce", (req, res) => {
  const parsed = siweNonceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  try {
    const nonce = issueSiweNonce(parsed.data.address, parsed.data.chainId);
    const message = buildSiweMessage({
      address: parsed.data.address,
      chainId: parsed.data.chainId,
      nonce,
      domain: req.headers.host || "localhost"
    });

    return res.json({ nonce, message });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.post("/siwe/verify", async (req, res) => {
  const parsed = siweVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  try {
    const tokens = await verifySiweLogin(parsed.data.message, parsed.data.signature);
    return res.json(tokens);
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
});

router.post("/refresh", (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  try {
    const tokens = rotateRefreshToken(parsed.data.refreshToken);
    return res.json(tokens);
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
});

router.post("/logout", (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  try {
    revokeRefreshToken(parsed.data.refreshToken);
    return res.json({ revoked: true });
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
});

export default router;
