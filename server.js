import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import anschreibenRouter from "./backend/routes/anschreiben.js";
import bewerbungsmappeRouter from "./backend/routes/bewerbungsmappe.js";
import { initDb } from "./db.js";
import { setupWebhook, telegramWebhookHandler } from "./backend/telegram/bot.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST"],
}));
app.use(express.json());

const ipLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 20,
  keyGenerator: (req) => req.ip,
  message: { error: "Too many requests. Please try again later." },
  skip: (req) => !!req.body?.telegramUserId,
});
const telegramLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 10,
  keyGenerator: (req) => req.body?.telegramUserId || req.ip,
  message: { error: "Too many requests from this Telegram account. Please wait." },
  skip: (req) => !req.body?.telegramUserId,
});

app.use("/api/", ipLimiter);
app.use("/api/", telegramLimiter);

app.post("/telegram/webhook", telegramWebhookHandler);

app.use("/api", anschreibenRouter);
app.use("/api", bewerbungsmappeRouter);

app.get("/health", (req, res) => res.json({ status: "ok", version: "3.0.0" }));

app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

initDb();
app.listen(PORT, async () => {
  console.log(`✅ Backend running on port ${PORT}`);
  await setupWebhook();
});
