import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.string().default("4000"),
  JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 characters"),
  JWT_REFRESH_SECRETS: z.string().min(16, "JWT_REFRESH_SECRETS must include at least one secret"),
  JWT_ACCESS_EXPIRES: z.string().default("15m"),
  JWT_REFRESH_EXPIRES: z.string().default("7d"),
  RPC_ETHEREUM: z.string().url(),
  RPC_POLYGON: z.string().url(),
  WS_ETHEREUM: z.string().optional(),
  WS_POLYGON: z.string().optional(),
  SIWE_URI: z.string().url().default("http://localhost:5173"),
  SIWE_STATEMENT: z.string().default("Sign in to CryptoVault."),
  VAULT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  COINGECKO_API: z.string().url().default("https://api.coingecko.com/api/v3")
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
