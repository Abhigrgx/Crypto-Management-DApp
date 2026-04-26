import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getPortfolio } from "../services/portfolioService.js";

const router = Router();

const querySchema = z.object({
  chain: z.enum(["ethereum", "polygon"]).default("ethereum"),
  tokens: z.string().optional()
});

router.get("/:address", requireAuth, async (req, res) => {
  const { address } = req.params;
  if (req.user.wallet?.toLowerCase() !== address.toLowerCase()) {
    return res.status(403).json({ error: "Cannot read another wallet profile" });
  }
  const parsed = querySchema.safeParse(req.query);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const tokenAddresses = parsed.data.tokens
    ? parsed.data.tokens
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  try {
    const portfolio = await getPortfolio(address, parsed.data.chain, tokenAddresses);
    return res.json(portfolio);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
