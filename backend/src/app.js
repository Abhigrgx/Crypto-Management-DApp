import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes.js";
import walletRoutes from "./routes/walletRoutes.js";
import portfolioRoutes from "./routes/portfolioRoutes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("combined"));

app.get("/health", (_req, res) => {
  return res.json({ status: "ok", service: "cryptovault-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/portfolio", portfolioRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
