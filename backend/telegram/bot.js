import TelegramBot from "node-telegram-bot-api";
import { upsertUser } from "../../db.js";
import { generateAnschreiben } from "../../backend/services/claudeService.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const BASE_URL = process.env.PUBLIC_BASE_URL || "";

if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");

export const bot = new TelegramBot(TOKEN, { webHook: true });

const sessions = {};
const STEPS = ["firstName","lastName","job","income","familySize","pets","city","maxRent","rooms","moveDate","extraNote","confirm"];
const PROMPTS = {
  firstName:  "👋 Willkommen beim WohnRadar Bot!\n\nWie ist dein *Vorname*?",
  lastName:   "Und dein *Nachname*?",
  job:        "Was ist dein *Beruf*?",
  income:     "Wie hoch ist dein monatliches *Nettoeinkommen* in €?\n_(Nur die Zahl, z.B. 2500)_",
  familySize: "Wie viele Personen ziehen ein?\n_(z.B. 1, 2, 3)_",
  pets:       "Hast du *Haustiere*? *(ja / nein)*",
  city:       "In welcher *Stadt* suchst du eine Wohnung?",
  maxRent:    "Was ist deine *maximale Warmmiete* in €/Monat?\n_(Nur die Zahl, z.B. 1200)_",
  rooms:      "Wie viele *Zimmer* brauchst du?\n_(z.B. 2, 2.5, 3)_",
  moveDate:   "Wann möchtest du *einziehen*?\n_(z.B. 01.08.2025 oder 'ab sofort')_",
  extraNote:  "Gibt es noch etwas *Wichtiges*?\n_(Optional – tippe '-' zum Überspringen)_",
};

function getSession(userId) {
  if (!sessions[userId]) sessions[userId] = { step: null, data: {} };
  return sessions[userId];
}
function resetSession(userId) {
  sessions[userId] = { step: STEPS[0], data: {} };
}
function buildSummary(data) {
  return `📋 *Zusammenfassung:*\n\n👤 ${data.firstName} ${data.lastName}\n💼 ${data.job}\n💰 ${data.income} €/Monat\n👨‍👩‍👧 ${data.familySize} Person(en)\n🐾 Haustiere: ${data.pets ? "Ja" : "Nein"}\n📍 ${data.city}\n🏠 Max. ${data.maxRent} €/Monat\n🚪 ${data.rooms} Zimmer\n📅 Einzug: ${data.moveDate}${data.extraNote && data.extraNote !== "-" ? `\n📝 ${data.extraNote}` : ""}\n\nAlles korrekt? Tippe *ja* oder *nein*.`;
}
async function sendStep(chatId, step, data) {
  const opts = { parse_mode: "Markdown" };
  if (step === "confirm") {
    await bot.sendMessage(chatId, buildSummary(data), opts);
  } else {
    await bot.sendMessage(chatId, PROMPTS[step], opts);
  }
}
function normalizeYN(text) {
  const t = text.trim().toLowerCase();
  if (["ja","yes","j","y"].includes(t)) return "ja";
  if (["nein","no","n"].includes(t)) return "nein";
  return null;
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = (msg.text || "").trim();

  if (text === "/start") {
    resetSession(userId);
    await sendStep(chatId, STEPS[0], {});
    return;
  }
  if (text === "/cancel") {
    sessions[userId] = { step: null, data: {} };
    await bot.sendMessage(chatId, "❌ Abgebrochen. Tippe /start um neu zu beginnen.");
    return;
  }

  const session = getSession(userId);
  if (!session.step) {
    await bot.sendMessage(chatId, "Tippe /start um zu beginnen. 🏠");
    return;
  }

  const step = session.step;

  if (step === "income" || step === "maxRent") {
    const num = parseFloat(text.replace(",", "."));
    if (isNaN(num) || num <= 0) { await bot.sendMessage(chatId, "⚠️ Bitte gib eine gültige Zahl ein."); return; }
    session.data[step] = num;
  } else if (step === "familySize") {
    const num = parseInt(text);
    if (isNaN(num) || num < 1) { await bot.sendMessage(chatId, "⚠️ Bitte gib eine Zahl ein."); return; }
    session.data[step] = num;
  } else if (step === "rooms") {
    const num = parseFloat(text.replace(",", "."));
    if (isNaN(num) || num < 1) { await bot.sendMessage(chatId, "⚠️ Bitte gib eine Zimmeranzahl ein."); return; }
    session.data[step] = num;
  } else if (step === "pets") {
    const yn = normalizeYN(text);
    if (!yn) { await bot.sendMessage(chatId, "⚠️ Bitte antworte mit *ja* oder *nein*.", { parse_mode: "Markdown" }); return; }
    session.data[step] = yn === "ja";
  } else if (step === "confirm") {
    const yn = normalizeYN(text);
    if (!yn) { await bot.sendMessage(chatId, "⚠️ Bitte antworte mit *ja* oder *nein*.", { parse_mode: "Markdown" }); return; }
    if (yn === "nein") {
      resetSession(userId);
      await bot.sendMessage(chatId, "🔄 Okay, von vorne!");
      await sendStep(chatId, STEPS[0], {});
      return;
    }
    await bot.sendMessage(chatId, "⏳ Generiere dein Anschreiben...");
    try {
      const profileData = { ...session.data, telegramUserId: userId, hasPets: session.data.pets };
      upsertUser(profileData);
      const anschreiben = await generateAnschreiben(profileData);
      await bot.sendMessage(chatId, `✅ *Dein Anschreiben:*\n\n${anschreiben}`, { parse_mode: "Markdown" });
      await bot.sendMessage(chatId, "🎉 Fertig! Tippe /start für ein neues Anschreiben.\n\n💎 *Premium (demnächst):* PDF-Versand per E-Mail!", { parse_mode: "Markdown" });
    } catch (err) {
      console.error("Anschreiben error:", err.message);
      await bot.sendMessage(chatId, "❌ Fehler beim Generieren. Bitte versuche es mit /start erneut.");
    }
    sessions[userId] = { step: null, data: {} };
    return;
  } else {
    if (!text) { await bot.sendMessage(chatId, "⚠️ Bitte gib eine Antwort ein."); return; }
    session.data[step] = text;
  }

  const nextStep = STEPS[STEPS.indexOf(step) + 1];
  session.step = nextStep;
  await sendStep(chatId, nextStep, session.data);
});

export async function setupWebhook() {
  if (!BASE_URL) { console.warn("⚠️ PUBLIC_BASE_URL not set – skipping webhook"); return; }
  const webhookUrl = `${BASE_URL}/telegram/webhook`;
  try {
    const opts = SECRET ? { secret_token: SECRET } : {};
    await bot.setWebHook(webhookUrl, opts);
    console.log(`✅ Telegram webhook set: ${webhookUrl}`);
  } catch (err) {
    console.error("❌ Webhook setup failed:", err.message);
  }
}

export function telegramWebhookHandler(req, res) {
  if (SECRET) {
    const incoming = req.headers["x-telegram-bot-api-secret-token"];
    if (incoming !== SECRET) return res.status(403).json({ error: "Forbidden" });
  }
  bot.processUpdate(req.body);
  res.sendStatus(200);
}
