import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/authMiddleware.js";
import { getProvider } from "../services/providerService.js";
import { getTransactionHistory } from "../services/indexerService.js";

const router = Router();

const querySchema = z.object({
  chain: z.enum(["ethereum", "polygon"]).default("ethereum")
});

router.get("/:address/balances", requireAuth, async (req, res) => {
  const { address } = req.params;
  if (req.user.wallet?.toLowerCase() !== address.toLowerCase()) {
    return res.status(403).json({ error: "Cannot read another wallet profile" });
  }
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  try {
    const provider = getProvider(parsed.data.chain);
    const balance = await provider.getBalance(address);
    return res.json({
      chain: parsed.data.chain,
      address,
      nativeBalanceWei: balance.toString()
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get("/:address/transactions", requireAuth, async (req, res) => {
  const { address } = req.params;
  if (req.user.wallet?.toLowerCase() !== address.toLowerCase()) {
    return res.status(403).json({ error: "Cannot read another wallet profile" });
  }
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  try {
    const history = await getTransactionHistory(address, parsed.data.chain);
    return res.json({ chain: parsed.data.chain, address, history });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
