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
  firstName:  "👋 خوش آمدید به WohnRadar!\n\n*نام* شما چیست؟",
  lastName:   "*نام خانوادگی* شما چیست؟",
  job:        "*شغل* شما چیست؟",
  income:     "*درآمد خالص ماهانه* شما چقدر است؟ (به یورو)\n_(فقط عدد، مثلاً 2500)_",
  familySize: "چند نفر *اسباب‌کشی می‌کنند*؟",
  pets:       "آیا *حیوان خانگی* دارید؟",
  city:       "در کدام *شهر* آلمان دنبال خانه می‌گردید؟",
  maxRent:    "حداکثر *اجاره ماهانه* (گرم) چقدر است؟ (به یورو)\n_(فقط عدد، مثلاً 1200)_",
  rooms:      "چند *اتاق* نیاز دارید؟",
  moveDate:   "تاریخ مورد نظر برای *اسباب‌کشی* چیست؟\n_(مثلاً 01.08.2025 یا 'هر چه زودتر')_",
  extraNote:  "آیا *نکته مهم دیگری* هست؟\n_(اختیاری - برای رد کردن '-' بزنید)_",
};

const KEYBOARDS = {
  familySize: { reply_markup: { keyboard: [["1"],["2"],["3"],["4 یا بیشتر"]], one_time_keyboard: true, resize_keyboard: true } },
  pets: { reply_markup: { keyboard: [["بله 🐾"],["خیر"]], one_time_keyboard: true, resize_keyboard: true } },
  rooms: { reply_markup: { keyboard: [["1"],["2"],["2.5"],["3"],["3.5"],["4 یا بیشتر"]], one_time_keyboard: true, resize_keyboard: true } },
  confirm: { reply_markup: { keyboard: [["✅ بله، ارسال شود"],["❌ خیر، از اول"]], one_time_keyboard: true, resize_keyboard: true } },
  extraNote: { reply_markup: { keyboard: [["-"]], one_time_keyboard: true, resize_keyboard: true } },
};

const REMOVE_KEYBOARD = { reply_markup: { remove_keyboard: true } };

function getSession(userId) {
  if (!sessions[userId]) sessions[userId] = { step: null, data: {} };
  return sessions[userId];
}
function resetSession(userId) {
  sessions[userId] = { step: STEPS[0], data: {} };
}
function buildSummary(data) {
  return `📋 *خلاصه اطلاعات شما:*\n\n👤 نام: ${data.firstName} ${data.lastName}\n💼 شغل: ${data.job}\n💰 درآمد: ${data.income} یورو/ماه\n👨‍👩‍👧 تعداد نفرات: ${data.familySize}\n🐾 حیوان خانگی: ${data.pets ? "بله" : "خیر"}\n📍 شهر: ${data.city}\n🏠 حداکثر اجاره: ${data.maxRent} یورو\n🚪 تعداد اتاق: ${data.rooms}\n📅 تاریخ اسباب‌کشی: ${data.moveDate}${data.extraNote && data.extraNote !== "-" ? `\n📝 توضیحات: ${data.extraNote}` : ""}\n\nآیا اطلاعات صحیح است؟`;
}

async function sendStep(chatId, step, data) {
  const opts = { parse_mode: "Markdown", ...(KEYBOARDS[step] || REMOVE_KEYBOARD) };
  if (step === "confirm") {
    

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
  firstName:  "👋 خوش آمدید به WohnRadar!\n\n*نام* شما چیست؟",
  lastName:   "*نام خانوادگی* شما چیست؟",
  job:        "*شغل* شما چیست؟",
  income:     "*درآمد خالص ماهانه* شما چقدر است؟ (به یورو)\n_(فقط عدد، مثلاً 2500)_",
  familySize: "چند نفر *اسباب‌کشی می‌کنند*؟",
  pets:       "آیا *حیوان خانگی* دارید؟",
  city:       "در کدام *شهر* آلمان دنبال خانه می‌گردید؟",
  maxRent:    "حداکثر *اجاره ماهانه* (گرم) چقدر است؟ (به یورو)\n_(فقط عدد، مثلاً 1200)_",
  rooms:      "چند *اتاق* نیاز دارید؟",
  moveDate:   "تاریخ مورد نظر برای *اسباب‌کشی* چیست؟\n_(مثلاً 01.08.2025 یا 'هر چه زودتر')_",
  extraNote:  "آیا *نکته مهم دیگری* هست؟\n_(اختیاری - برای رد کردن '-' بزنید)_",
};

const KEYBOARDS = {
  familySize: { reply_markup: { keyboard: [["1"],["2"],["3"],["4 یا بیشتر"]], one_time_keyboard: true, resize_keyboard: true } },
  pets: { reply_markup: { keyboard: [["بله 🐾"],["خیر"]], one_time_keyboard: true, resize_keyboard: true } },
  rooms: { reply_markup: { keyboard: [["1"],["2"],["2.5"],["3"],["3.5"],["4 یا بیشتر"]], one_time_keyboard: true, resize_keyboard: true } },
  confirm: { reply_markup: { keyboard: [["✅ بله، ارسال شود"],["❌ خیر، از اول"]], one_time_keyboard: true, resize_keyboard: true } },
  extraNote: { reply_markup: { keyboard: [["-"]], one_time_keyboard: true, resize_keyboard: true } },
};

const REMOVE_KEYBOARD = { reply_markup: { remove_keyboard: true } };

function getSession(userId) {
  if (!sessions[userId]) sessions[userId] = { step: null, data: {} };
  return sessions[userId];
}
function resetSession(userId) {
  sessions[userId] = { step: STEPS[0], data: {} };
}
function buildSummary(data) {
  return `📋 *خلاصه اطلاعات شما:*\n\n👤 نام: ${data.firstName} ${data.lastName}\n💼 شغل: ${data.job}\n💰 درآمد: ${data.income} یورو/ماه\n👨‍👩‍👧 تعداد نفرات: ${data.familySize}\n🐾 حیوان خانگی: ${data.pets ? "بله" : "خیر"}\n📍 شهر: ${data.city}\n🏠 حداکثر اجاره: ${data.maxRent} یورو\n🚪 تعداد اتاق: ${data.rooms}\n📅 تاریخ اسباب‌کشی: ${data.moveDate}${data.extraNote && data.extraNote !== "-" ? `\n📝 توضیحات: ${data.extraNote}` : ""}\n\nآیا اطلاعات صحیح است؟`;
}

async function sendStep(chatId, step, data) {
  const opts = { parse_mode: "Markdown", ...(KEYBOARDS[step] || REMOVE_KEYBOARD) };
  if (step === "confirm") {
    await bot.sendMessage(chatId, buildSummary(data), opts);
  } else {
    await bot.sendMessage(chatId, PROMPTS[step], opts);
  }
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = (msg.text || "").trim();

  if (text === "/start") {
    resetSession(userId);
    await bot.sendMessage(chatId, "🏠 *WohnRadar - دستیار یافتن خانه در آلمان*\n\nبرای نوشتن نامه درخواست اجاره (Anschreiben) به چند سوال پاسخ دهید.", { parse_mode: "Markdown", ...REMOVE_KEYBOARD });
    await sendStep(chatId, STEPS[0], {});
    return;
  }
  if (text === "/cancel") {
    sessions[userId] = { step: null, data: {} };
    await bot.sendMessage(chatId, "❌ لغو شد. برای شروع مجدد /start بزنید.", REMOVE_KEYBOARD);
    return;
  }

  const session = getSession(userId);
  if (!session.step) { await bot.sendMessage(chatId, "برای شروع /start بزنید. 🏠"); return; }

  const step = session.step;

  if (step === "income" || step === "maxRent") {
    const num = parseFloat(text.replace(",", ".").replace(/[^\d.]/g, ""));
    if (isNaN(num) || num <= 0) { await bot.sendMessage(chatId, "⚠️ لطفاً یک عدد معتبر وارد کنید."); return; }
    session.data[step] = num;
  } else if (step === "familySize") {
    const num = parseInt(text.replace(/[^\d]/g, "")) || (text.includes("4") ? 4 : NaN);
    if (isNaN(num) || num < 1) { await bot.sendMessage(chatId, "⚠️ لطفاً تعداد نفرات را وارد کنید."); return; }
    session.data[step] = num;
  } else if (step === "rooms") {
    const num = parseFloat(text.replace(",", ".").replace(/[^\d.]/g, ""));
    if (isNaN(num) || num < 1) { await bot.sendMessage(chatId, "⚠️ لطفاً تعداد اتاق را وارد کنید."); return; }
    session.data[step] = num;
  } else if (step === "pets") {
    const yes = ["بله","yes","ja","y","j","بله 🐾"].includes(text.toLowerCase());
    const no = ["خیر","no","nein","n"].includes(text.toLowerCase());
    if (!yes && !no) { await bot.sendMessage(chatId, "⚠️ لطفاً یکی از گزینه‌ها را انتخاب کنید.", KEYBOARDS.pets); return; }
    session.data[step] = yes;
  } else if (step === "confirm") {
    const yes = text.includes("بله") || text.toLowerCase() === "ja";
    const no = text.includes("خیر") || text.toLowerCase() === "nein";
    if (!yes && !no) { await bot.sendMessage(chatId, "⚠️ لطفاً یکی از گزینه‌ها را انتخاب کنید.", KEYBOARDS.confirm); return; }
    if (no) { resetSession(userId); await bot.sendMessage(chatId, "🔄 از ابتدا شروع می‌کنیم!"); await sendStep(chatId, STEPS[0], {}); return; }
    await bot.sendMessage(chatId, "⏳ در حال نوشتن نامه... لطفاً چند لحظه صبر کنید.", REMOVE_KEYBOARD);
    try {
      const profileData = { ...session.data, telegramUserId: userId, hasPets: session.data.pets };
      upsertUser(profileData);
      const anschreiben = await generateAnschreiben(profileData);
      await bot.sendMessage(chatId, `✅ *نامه درخواست شما (Anschreiben):*\n\n${anschreiben}`, { parse_mode: "Markdown" });
      await bot.sendMessage(chatId, "🎉 نامه آماده است! می‌توانید آن را کپی کرده و برای درخواست خانه استفاده کنید.\n\n💎 *بزودی:* ارسال PDF به ایمیل!\n\nبرای نامه جدید /start بزنید.", { parse_mode: "Markdown" });
    } catch (err) {
      console.error("Anschreiben error:", err.message);
      await bot.sendMessage(chatId, "❌ خطا در نوشتن نامه. لطفاً دوباره /start بزنید.");
    }
    sessions[userId] = { step: null, data: {} };
    return;
  } else {
    if (!text) { await bot.sendMessage(chatId, "⚠️ لطفاً پاسخ دهید."); return; }
    session.data[step] = text;
  }

  const nextStep = STEPS[STEPS.indexOf(step) + 1];
  session.step = nextStep;
  await sendStep(chatId, nextStep, session.data);
});

export async function setupWebhook() {
  if (!BASE_URL) { console.warn("⚠️ PUBLIC_BASE_URL not set"); return; }
  try {
    const opts = SECRET ? { secret_token: SECRET } : {};
    await bot.setWebHook(`${BASE_URL}/telegram/webhook`, opts);
    console.log(`✅ Telegram webhook set: ${BASE_URL}/telegram/webhook`);
  } catch (err) { console.error("❌ Webhook setup failed:", err.message); }
}

export function telegramWebhookHandler(req, res) {
  if (SECRET) {
    const incoming = req.headers["x-telegram-bot-api-secret-token"];
    if (incoming !== SECRET) return res.status(403).json({ error: "Forbidden" });
  }
  bot.processUpdate(req.body);
  res.sendStatus(200);
}
