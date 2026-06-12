import TelegramBot from "node-telegram-bot-api";
import { upsertUser } from "../../db.js";
import { generateAnschreiben } from "../services/claudeService.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const BASE_URL = process.env.PUBLIC_BASE_URL || "";

if (!TOKEN) throw new Error("TELEGRAM_BOT_TOKEN is not set");

export const bot = new TelegramBot(TOKEN, { webHook: true });

const sessions = {};

const STEPS = [
  "firstName",
  "lastName",
  "job",
  "income",
  "familySize",
  "pets",
  "city",
  "maxRent",
  "rooms",
  "moveDate",
  "extraNote",
  "confirm",
];

const FA = {
  welcome: "به WohnRadar خوش آمدید.\n\nاین ربات برای درخواست اجاره خانه در آلمان، متن آلمانی حرفه‌ای می‌سازد.",
  firstName: "نام شما چیست؟",
  lastName: "نام خانوادگی شما چیست؟",
  job: "وضعیت شغلی شما چیست؟",
  income: "درآمد خالص ماهانه شما چند یورو است؟\nفقط عدد وارد کنید.",
  familySize: "چند نفر قرار است در خانه زندگی کنند؟",
  pets: "حیوان خانگی دارید؟",
  city: "در کدام شهر دنبال خانه می‌گردید؟",
  maxRent: "حداکثر اجاره گرم چند یورو است؟\nفقط عدد وارد کنید.",
  rooms: "چند اتاق نیاز دارید؟",
  moveDate: "تاریخ اسباب‌کشی چه زمانی است؟\nمثال: 2026-07-01",
  extraNote: "توضیح اضافه‌ای دارید؟\nاگر ندارید، روی «رد کردن» بزنید.",
  cancelled: "فرایند لغو شد. برای شروع دوباره /start را بزنید.",
  error: "مشکلی پیش آمد. لطفاً دوباره امتحان کنید یا /start را بزنید.",
};

const LABELS = {
  employee: "کارمند",
  self_employed: "خوداشتغال",
  student: "دانشجو",
  retired: "بازنشسته",
  other: "سایر",
  pet_no: "خیر، حیوان خانگی ندارم",
  pet_yes: "بله، حیوان خانگی دارم",
  skip: "رد کردن",
  confirm_yes: "✅ تولید نامه",
  confirm_restart: "🔄 شروع از اول",
};

const RK = { reply_markup: { remove_keyboard: true } };

function keyboard(rows) {
  return {
    reply_markup: {
      keyboard: rows,
      resize_keyboard: true,
      one_time_keyboard: true,
    },
  };
}

const KB = {
  job: keyboard([
    [LABELS.employee, LABELS.self_employed],
    [LABELS.student, LABELS.retired],
    [LABELS.other],
  ]),
  familySize: keyboard([
    ["۱ نفر", "۲ نفر"],
    ["۳ نفر", "۴ نفر یا بیشتر"],
  ]),
  pets: keyboard([
    [LABELS.pet_no],
    [LABELS.pet_yes],
  ]),
  rooms: keyboard([
    ["۱", "۱.۵", "۲"],
    ["۲.۵", "۳", "۴+"],
  ]),
  extraNote: keyboard([[LABELS.skip]]),
  confirm: keyboard([
    [LABELS.confirm_yes],
    [LABELS.confirm_restart],
  ]),
};

function normalizePersian(text = "") {
  return String(text)
    .trim()
    .normalize("NFC")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c+/g, "‌")
    .replace(/\s+/g, " ");
}

function toLatinDigits(value = "") {
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  const arabic = "٠١٢٣٤٥٦٧٨٩";

  return String(value)
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)));
}

function cleanInput(value = "") {
  return normalizePersian(value);
}

function parseNumber(value) {
  const cleaned = toLatinDigits(value).replace(",", ".").replace(/[^0-9.]/g, "");
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function normalizeJob(value) {
  const v = normalizePersian(value);
  const map = {
    [LABELS.employee]: "employee",
    [LABELS.self_employed]: "self_employed",
    [LABELS.student]: "student",
    [LABELS.retired]: "retired",
    [LABELS.other]: "other",
  };
  return map[v] || "other";
}

function normalizeFamilySize(value) {
  const v = toLatinDigits(normalizePersian(value));
  if (v.includes("4")) return 4;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function normalizePets(value) {
  const v = normalizePersian(value);
  if (v === LABELS.pet_no || v === "خیر" || v.toLowerCase() === "no" || v.toLowerCase() === "nein") return false;
  if (v === LABELS.pet_yes || v === "بله" || v.toLowerCase() === "yes" || v.toLowerCase() === "ja") return true;
  return null;
}

function normalizeRooms(value) {
  const v = toLatinDigits(normalizePersian(value)).replace(",", ".");
  if (v.includes("4+")) return "4+";
  const num = Number.parseFloat(v);
  if (!Number.isFinite(num) || num < 1) return null;
  return String(num).replace(".5", ".5");
}

function getSession(userId) {
  if (!sessions[userId]) sessions[userId] = { step: null, data: {} };
  return sessions[userId];
}

function resetSession(userId) {
  sessions[userId] = { step: STEPS[0], data: {} };
}

function clearSession(userId) {
  sessions[userId] = { step: null, data: {} };
}

function employmentLabel(value) {
  const map = {
    employee: "کارمند",
    self_employed: "خوداشتغال",
    student: "دانشجو",
    retired: "بازنشسته",
    other: "سایر",
  };
  return map[value] || value || "-";
}

function buildSummary(d) {
  return [
    "خلاصه:",
    "",
    `👤 نام: ${d.firstName} ${d.lastName}`,
    `💼 وضعیت شغلی: ${employmentLabel(d.employmentStatus)}`,
    `💶 درآمد: ${d.income} €`,
    `👥 تعداد نفرات: ${d.familySize}`,
    `🐾 حیوان خانگی: ${d.hasPets ? "بله" : "خیر"}`,
    `📍 شهر: ${d.city}`,
    `🏠 اجاره گرم تا: ${d.maxRent} €`,
    `🚪 تعداد اتاق: ${d.rooms}`,
    `📅 تاریخ اسباب‌کشی: ${d.moveDate}`,
    d.extraNote ? `📝 توضیح: ${d.extraNote}` : null,
    "",
    "تأیید می‌کنید؟",
  ]
    .filter(Boolean)
    .join("\n");
}

async function sendStep(chatId, step, data = {}) {
  if (step === "confirm") {
    await bot.sendMessage(chatId, buildSummary(data), KB.confirm);
    return;
  }

  await bot.sendMessage(chatId, FA[step], KB[step] || RK);
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = cleanInput(msg.text || "");

  const session = getSession(userId);
  const beforeStep = session.step;

  console.log("[telegram message]", {
    userId,
    text,
    beforeStep,
  });

  try {
    if (text === "/start") {
      resetSession(userId);
      await bot.sendMessage(chatId, FA.welcome, RK);
      await sendStep(chatId, STEPS[0], {});
      return;
    }

    if (text === "/cancel") {
      clearSession(userId);
      await bot.sendMessage(chatId, FA.cancelled, RK);
      return;
    }

    if (text === "/help") {
      await bot.sendMessage(
        chatId,
        "دستورها:\n/start شروع دوباره\n/cancel لغو فرایند\n/help راهنما\n/about درباره پروژه",
        RK
      );
      return;
    }

    if (text === "/about") {
      await bot.sendMessage(
        chatId,
        "WohnRadar برای فارسی‌زبانان آلمان ساخته شده و متن آلمانی درخواست اجاره خانه تولید می‌کند.",
        RK
      );
      return;
    }

    if (!session.step) {
      await bot.sendMessage(chatId, "برای شروع /start را بزنید.", RK);
      return;
    }

    const step = session.step;

    if (step === "firstName" || step === "lastName" || step === "city" || step === "moveDate") {
      if (!text) {
        await bot.sendMessage(chatId, "لطفاً پاسخ را وارد کنید.");
        return;
      }
      session.data[step] = text;
    }

    else if (step === "job") {
      const job = normalizeJob(text);
      session.data.employmentStatus = job;
      session.data.job = employmentLabel(job);
    }

    else if (step === "income" || step === "maxRent") {
      const num = parseNumber(text);
      if (!num) {
        await bot.sendMessage(chatId, "لطفاً فقط عدد معتبر وارد کنید.");
        return;
      }
      session.data[step] = num;
    }

    else if (step === "familySize") {
      const n = normalizeFamilySize(text);
      if (!n) {
        await bot.sendMessage(chatId, "لطفاً یکی از گزینه‌ها را انتخاب کنید.", KB.familySize);
        return;
      }
      session.data.familySize = n;
    }

    else if (step === "pets") {
      const value = normalizePets(text);
      if (value === null) {
        await bot.sendMessage(chatId, "لطفاً یکی از گزینه‌ها را انتخاب کنید.", KB.pets);
        return;
      }
      session.data.hasPets = value;
      session.data.pets = value ? "yes" : "no";
    }

    else if (step === "rooms") {
      const value = normalizeRooms(text);
      if (!value) {
        await bot.sendMessage(chatId, "لطفاً یکی از گزینه‌ها را انتخاب کنید.", KB.rooms);
        return;
      }
      session.data.rooms = value;
    }

    else if (step === "extraNote") {
      session.data.extraNote = text === LABELS.skip || text === "-" ? "" : text;
    }

    else if (step === "confirm") {
      if (text === LABELS.confirm_restart) {
        resetSession(userId);
        await bot.sendMessage(chatId, "از اول شروع می‌کنیم.", RK);
        await sendStep(chatId, STEPS[0], {});
        return;
      }

      if (text !== LABELS.confirm_yes) {
        await bot.sendMessage(chatId, "لطفاً یکی از گزینه‌ها را انتخاب کنید.", KB.confirm);
        return;
      }

      await bot.sendMessage(chatId, "در حال نوشتن نامه...", RK);

      const profileData = {
        ...session.data,
        telegramUserId: userId,
      };

      upsertUser(profileData);

      const anschreiben = await generateAnschreiben(profileData);

      await bot.sendMessage(chatId, "نامه شما:\n\n" + anschreiben, RK);
      await bot.sendMessage(chatId, "برای ساخت نامه جدید /start را بزنید.");

      clearSession(userId);
      return;
    }

    const currentIndex = STEPS.indexOf(step);
    const nextStep = STEPS[currentIndex + 1];

    session.step = nextStep;

    console.log("[telegram step]", {
      userId,
      beforeStep: step,
      afterStep: nextStep,
    });

    await sendStep(chatId, nextStep, session.data);
  } catch (err) {
    console.error("[telegram error]", err);
    await bot.sendMessage(chatId, FA.error, RK);
  }
});

export async function setupWebhook() {
  if (!BASE_URL) {
    console.warn("PUBLIC_BASE_URL not set");
    return;
  }

  try {
    const opts = SECRET ? { secret_token: SECRET } : {};
    await bot.setWebHook(BASE_URL + "/telegram/webhook", opts);
    console.log("Webhook set: " + BASE_URL + "/telegram/webhook");
  } catch (err) {
    console.error("Webhook failed:", err.message);
  }
}

export function telegramWebhookHandler(req, res) {
  if (SECRET) {
    const token = req.headers["x-telegram-bot-api-secret-token"];
    if (token !== SECRET) return res.status(403).json({ error: "Forbidden" });
  }

  bot.processUpdate(req.body);
  res.sendStatus(200);
}