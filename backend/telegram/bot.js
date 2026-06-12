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
  firstName:  "\u0628\u0647 WohnRadar \u062e\u0648\u0634 \u0622\u0645\u062f\u06cc\u062f!\n\n\u0646\u0627\u0645 \u0634\u0645\u0627 \u0686\u06cc\u0633\u062a\u061f",
  lastName:   "\u0646\u0627\u0645 \u062e\u0627\u0646\u0648\u0627\u062f\u06af\u06cc \u0634\u0645\u0627 \u0686\u06cc\u0633\u062a\u061f",
  job:        "\u0634\u063a\u0644 \u0634\u0645\u0627 \u0686\u06cc\u0633\u062a\u061f",
  income:     "\u062f\u0631\u0622\u0645\u062f \u062e\u0627\u0644\u0635 \u0645\u0627\u0647\u0627\u0646\u0647 (\u06cc\u0648\u0631\u0648):\n\u0641\u0642\u0637 \u0639\u062f\u062f",
  familySize: "\u0686\u0646\u062f \u0646\u0641\u0631 \u0627\u0633\u0628\u0627\u0628 \u06a9\u0634\u06cc \u0645\u06cc \u06a9\u0646\u0646\u062f\u061f",
  pets:       "\u062d\u06cc\u0648\u0627\u0646 \u062e\u0627\u0646\u06af\u06cc \u062f\u0627\u0631\u06cc\u062f\u061f",
  city:       "\u062f\u0631 \u06a9\u062f\u0627\u0645 \u0634\u0647\u0631 \u062f\u0646\u0628\u0627\u0644 \u062e\u0627\u0646\u0647 \u0645\u06cc \u06af\u0631\u062f\u06cc\u062f\u061f",
  maxRent:    "\u062d\u062f\u0627\u06a9\u062b\u0631 \u0627\u062c\u0627\u0631\u0647 (\u06cc\u0648\u0631\u0648):\n\u0641\u0642\u0637 \u0639\u062f\u062f",
  rooms:      "\u0686\u0646\u062f \u0627\u062a\u0627\u0642 \u0646\u06cc\u0627\u0632 \u062f\u0627\u0631\u06cc\u062f\u061f",
  moveDate:   "\u062a\u0627\u0631\u06cc\u062e \u0627\u0633\u0628\u0627\u0628 \u06a9\u0634\u06cc \u0686\u06cc\u0633\u062a\u061f",
  extraNote:  "\u0646\u06a9\u062a\u0647 \u0645\u0647\u0645\u06cc \u0647\u0633\u062a\u061f (- \u0628\u0632\u0646\u06cc\u062f \u0628\u0631\u0627\u06cc \u0631\u062f \u06a9\u0631\u062f\u0646)",
};

const KB = {
  familySize: { reply_markup: { keyboard: [["1"],["2"],["3"],["4+"]], one_time_keyboard: true, resize_keyboard: true } },
  pets: { reply_markup: { keyboard: [["\u0628\u0644\u0647"],["\u062e\u06cc\u0631"]], one_time_keyboard: true, resize_keyboard: true } },
  rooms: { reply_markup: { keyboard: [["1"],["2"],["2.5"],["3"],["3.5"],["4+"]], one_time_keyboard: true, resize_keyboard: true } },
  confirm: { reply_markup: { keyboard: [["\u0628\u0644\u0647 \u062a\u0627\u06cc\u06cc\u062f \u0645\u06cc\u06a9\u0646\u0645"],["\u062e\u06cc\u0631 \u0627\u0632 \u0627\u0648\u0644"]], one_time_keyboard: true, resize_keyboard: true } },
  extraNote: { reply_markup: { keyboard: [["-"]], one_time_keyboard: true, resize_keyboard: true } },
};

const RK = { reply_markup: { remove_keyboard: true } };

function getSession(id) { if (!sessions[id]) sessions[id] = { step: null, data: {} }; return sessions[id]; }
function resetSession(id) { sessions[id] = { step: STEPS[0], data: {} }; }

function buildSummary(d) {
  return "\u062e\u0644\u0627\u0635\u0647:\n\n" +
    "\u0646\u0627\u0645: " + d.firstName + " " + d.lastName + "\n" +
    "\u0634\u063a\u0644: " + d.job + "\n" +
    "\u062f\u0631\u0622\u0645\u062f: " + d.income + " EUR\n" +
    "\u0646\u0641\u0631\u0627\u062a: " + d.familySize + "\n" +
    "\u062d\u06cc\u0648\u0627\u0646: " + (d.pets ? "\u0628\u0644\u0647" : "\u062e\u06cc\u0631") + "\n" +
    "\u0634\u0647\u0631: " + d.city + "\n" +
    "\u0627\u062c\u0627\u0631\u0647: " + d.maxRent + " EUR\n" +
    "\u0627\u062a\u0627\u0642: " + d.rooms + "\n" +
    "\u0627\u0633\u0628\u0627\u0628\u06a9\u0634\u06cc: " + d.moveDate +
    (d.extraNote && d.extraNote !== "-" ? "\n\u062a\u0648\u0636\u06cc\u062d: " + d.extraNote : "") +
    "\n\n\u0622\u06cc\u0627 \u0635\u062d\u06cc\u062d \u0627\u0633\u062a\u061f";
}

async function sendStep(chatId, step, data) {
  const opts = { ...(KB[step] || RK) };
  await bot.sendMessage(chatId, step === "confirm" ? buildSummary(data) : PROMPTS[step], opts);
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = (msg.text || "").trim();

  if (text === "/start") {
    resetSession(userId);
    await bot.sendMessage(chatId, "WohnRadar - \u062f\u0633\u062a\u06cc\u0627\u0631 \u06cc\u0627\u0641\u062a\u0646 \u062e\u0627\u0646\u0647 \u062f\u0631 \u0622\u0644\u0645\u0627\u0646", RK);
    await sendStep(chatId, STEPS[0], {});
    return;
  }
  if (text === "/cancel") {
    sessions[userId] = { step: null, data: {} };
    await bot.sendMessage(chatId, "\u0644\u063a\u0648 \u0634\u062f. /start", RK);
    return;
  }

  const session = getSession(userId);
  if (!session.step) { await bot.sendMessage(chatId, "/start"); return; }

  const step = session.step;

  if (step === "income" || step === "maxRent") {
    const num = parseFloat(text.replace(/[^0-9.]/g, ""));
    if (isNaN(num) || num <= 0) { await bot.sendMessage(chatId, "\u0639\u062f\u062f \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f"); return; }
    session.data[step] = num;
  } else if (step === "familySize") {
    const num = parseInt(text) || (text.includes("4") ? 4 : NaN);
    if (isNaN(num) || num < 1) { await bot.sendMessage(chatId, "\u0639\u062f\u062f \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f"); return; }
    session.data[step] = num;
  } else if (step === "rooms") {
    const num = parseFloat(text.replace(/[^0-9.]/g, ""));
    if (isNaN(num) || num < 1) { await bot.sendMessage(chatId, "\u0639\u062f\u062f \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f"); return; }
    session.data[step] = num;
  } else if (step === "pets") {
    const yes = ["\u0628\u0644\u0647","ja","yes"].includes(text.toLowerCase());
    const no = ["\u062e\u06cc\u0631","nein","no"].includes(text.toLowerCase());
    if (!yes && !no) { await bot.sendMessage(chatId, "\u0628\u0644\u0647 \u06cc\u0627 \u062e\u06cc\u0631", KB.pets); return; }
    session.data[step] = yes;
  } else if (step === "confirm") {
    const yes = text.includes("\u0628\u0644\u0647") || text.toLowerCase() === "ja";
    const no = text.includes("\u062e\u06cc\u0631") || text.toLowerCase() === "nein";
    if (!yes && !no) { await bot.sendMessage(chatId, "\u06cc\u06a9\u06cc \u0631\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f", KB.confirm); return; }
    if (no) { resetSession(userId); await bot.sendMessage(chatId, "\u0627\u0632 \u0627\u0648\u0644!"); await sendStep(chatId, STEPS[0], {}); return; }
    await bot.sendMessage(chatId, "\u062f\u0631 \u062d\u0627\u0644 \u0646\u0648\u0634\u062a\u0646 \u0646\u0627\u0645\u0647...", RK);
    try {
      const profileData = { ...session.data, telegramUserId: userId, hasPets: session.data.pets };
      upsertUser(profileData);
      const anschreiben = await generateAnschreiben(profileData);
      await bot.sendMessage(chatId, "\u0646\u0627\u0645\u0647 \u0634\u0645\u0627:\n\n" + anschreiben);
      await bot.sendMessage(chatId, "\u0622\u0645\u0627\u062f\u0647 \u0627\u0633\u062a! /start \u0628\u0631\u0627\u06cc \u0646\u0627\u0645\u0647 \u062c\u062f\u06cc\u062f.");
    } catch (err) {
      console.error("Anschreiben error:", err.message);
      await bot.sendMessage(chatId, "\u062e\u0637\u0627. /start \u0628\u0632\u0646\u06cc\u062f.");
    }
    sessions[userId] = { step: null, data: {} };
    return;
  } else {
    if (!text) { await bot.sendMessage(chatId, "\u067e\u0627\u0633\u062e \u062f\u0647\u06cc\u062f"); return; }
    session.data[step] = text;
  }

  const nextStep = STEPS[STEPS.indexOf(step) + 1];
  session.step = nextStep;
  await sendStep(chatId, nextStep, session.data);
});

export async function setupWebhook() {
  if (!BASE_URL) { console.warn("PUBLIC_BASE_URL not set"); return; }
  try {
    const opts = SECRET ? { secret_token: SECRET } : {};
    await bot.setWebHook(BASE_URL + "/telegram/webhook", opts);
    console.log("Webhook set: " + BASE_URL + "/telegram/webhook");
  } catch (err) { console.error("Webhook failed:", err.message); }
}

export function telegramWebhookHandler(req, res) {
  if (SECRET) {
    const t = req.headers["x-telegram-bot-api-secret-token"];
    if (t !== SECRET) return res.status(403).json({ error: "Forbidden" });
  }
  bot.processUpdate(req.body);
  res.sendStatus(200);
}
