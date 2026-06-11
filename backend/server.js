import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";

import anschreibenRouter from "./routes/anschreiben.js";
import bewerbungsmappeRouter from "./routes/bewerbungsmappe.js";
import { initDb } from "./db.js";

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST"],
}));
app.use(express.json());

// ── Rate limiting ─────────────────────────────────────────────
// Public / browser traffic: limit by IP (reasonable for frontend users)
const ipLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 20,
  keyGenerator: (req) => req.ip,
  message: { error: "Too many requests. Please try again later." },
  skip: (req) => !!req.body?.telegramUserId, // bot requests use a different limiter
});

// Fix 2 — Telegram bot requests: limit by telegramUserId, not IP.
// All Telegram traffic arrives from the same bot server IP, so IP-based limiting
// would block every user after the first 20 hits on any window.
const telegramLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 min
  max: 10,                   // 10 generations per user per 10 min is plenty for testing
  keyGenerator: (req) => req.body?.telegramUserId || req.ip,
  message: { error: "Too many requests from this Telegram account. Please wait." },
  skip: (req) => !req.body?.telegramUserId, // only applies to bot requests
});

app.use("/api/", ipLimiter);
app.use("/api/", telegramLimiter);

// ── Routes ────────────────────────────────────────────────────
app.use("/api", anschreibenRouter);
app.use("/api", bewerbungsmappeRouter);

app.get("/health", (req, res) => res.json({ status: "ok", version: "2.1.0" }));

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ─────────────────────────────────────────────────────
initDb();
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
