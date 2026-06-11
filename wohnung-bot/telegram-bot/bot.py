"""
Wohnung Bot — Telegram Bot
زبان مکالمه: فارسی
ارتباط با backend: REST API
"""

import os
import logging
import httpx
from io import BytesIO
from dotenv import load_dotenv
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardMarkup,
    ReplyKeyboardRemove,
)
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ConversationHandler,
    filters,
    ContextTypes,
)

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

BOT_TOKEN   = os.getenv("TELEGRAM_BOT_TOKEN")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001")

# ── Conversation states ───────────────────────────────────────
(
    FIRST_NAME, LAST_NAME, JOB, INCOME,
    FAMILY_SIZE, PETS, CITY, MAX_RENT,
    ROOMS, MOVE_DATE, EXTRA_NOTE,
    CONFIRM,
) = range(12)

CITIES = [
    ["Hamburg",     "Berlin",     "München"],
    ["Frankfurt",   "Köln",       "Stuttgart"],
    ["Düsseldorf",  "Leipzig",    "Bremen"],
    ["Hannover",    "Nürnberg",   "Dresden"],
]

ROOMS_OPTIONS = [["1", "1.5", "2"], ["2.5", "3", "3.5"], ["4", "4+"]]

# ── Helpers ───────────────────────────────────────────────────

def profile_summary(d: dict) -> str:
    pets = "بله" if d.get("hasPets") else "خیر"
    return (
        f"👤 *{d['firstName']} {d['lastName']}*\n"
        f"💼 شغل: {d['job']}\n"
        f"💶 درآمد: {d['income']}€\n"
        f"👨‍👩‍👧 خانوار: {d['familySize']} نفر | حیوان: {pets}\n"
        f"📍 شهر: {d['city']}\n"
        f"🏠 اجاره: تا {d['maxRent']}€ | {d['rooms']} اتاق\n"
        f"📅 نقل مکان: {d['moveDate']}\n"
    )


def main_keyboard():
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("📋 متن درخواست جدید", callback_data="new_application")],
        [InlineKeyboardButton("📁 دریافت Bewerbungsmappe PDF", callback_data="get_pdf")],
        [InlineKeyboardButton("⚡ نسخه پریمیوم", callback_data="premium_info")],
    ])


async def call_backend(endpoint: str, payload: dict) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{BACKEND_URL}/api/{endpoint}", json=payload)
            r.raise_for_status()
            return r.json()
    except httpx.HTTPStatusError as e:
        logger.error("Backend HTTP error %s: %s", e.response.status_code, e.response.text)
        return None
    except Exception as e:
        logger.error("Backend call error: %s", e)
        return None


async def download_pdf(payload: dict) -> bytes | None:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{BACKEND_URL}/api/generate-bewerbungsmappe", json=payload
            )
            r.raise_for_status()
            return r.content
    except Exception as e:
        logger.error("PDF download error: %s", e)
        return None


# ── /start ────────────────────────────────────────────────────

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data.clear()
    await update.message.reply_text(
        "سلام! 👋 خوش آمدید به *Wohnung Bot*\n\n"
        "این ربات به شما کمک می‌کند یک متن درخواست حرفه‌ای آلمانی "
        "برای اجاره خانه بسازید.\n\n"
        "چند سوال کوتاه می‌پرسم و در چند ثانیه متن آماده می‌شود.\n\n"
        "لطفاً *نام* خود را وارد کنید:",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardRemove(),
    )
    return FIRST_NAME


# ── Conversation steps ────────────────────────────────────────

async def get_first_name(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["firstName"] = update.message.text.strip()
    await update.message.reply_text("نام خانوادگی شما:")
    return LAST_NAME


async def get_last_name(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["lastName"] = update.message.text.strip()
    await update.message.reply_text(
        "شغل خود را به آلمانی یا انگلیسی بنویسید:\n"
        "_(مثال: Softwareentwickler, Krankenpfleger, Ingenieur)_",
        parse_mode="Markdown",
    )
    return JOB


async def get_job(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["job"] = update.message.text.strip()
    await update.message.reply_text(
        "درآمد ماهانه خالص (Nettoeinkommen) به یورو:\n"
        "_(فقط عدد وارد کنید، مثال: 2500)_",
        parse_mode="Markdown",
    )
    return INCOME


async def get_income(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().replace(",", "").replace(".", "")
    if not text.isdigit() or not (100 <= int(text) <= 99999):
        await update.message.reply_text("⚠️ لطفاً یک عدد معتبر وارد کنید (مثال: 2500):")
        return INCOME
    ctx.user_data["income"] = int(text)
    kb = ReplyKeyboardMarkup(
        [["1", "2", "3"], ["4", "5", "6+"]], one_time_keyboard=True, resize_keyboard=True
    )
    await update.message.reply_text("تعداد نفرات خانوار:", reply_markup=kb)
    return FAMILY_SIZE


async def get_family_size(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().replace("+", "")
    if not text.isdigit() or not (1 <= int(text) <= 10):
        await update.message.reply_text("⚠️ عدد بین ۱ تا ۱۰ وارد کنید:")
        return FAMILY_SIZE
    ctx.user_data["familySize"] = int(text)
    kb = ReplyKeyboardMarkup([["بله ✅", "خیر ❌"]], one_time_keyboard=True, resize_keyboard=True)
    await update.message.reply_text("آیا حیوان خانگی دارید؟", reply_markup=kb)
    return PETS


async def get_pets(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["hasPets"] = "بله" in update.message.text
    kb = ReplyKeyboardMarkup(CITIES, one_time_keyboard=True, resize_keyboard=True)
    await update.message.reply_text("شهر مورد نظر را انتخاب کنید:", reply_markup=kb)
    return CITY


async def get_city(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["city"] = update.message.text.strip()
    await update.message.reply_text(
        "حداکثر اجاره ماهانه (Warmmiete) به یورو:\n_(فقط عدد، مثال: 1200)_",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardRemove(),
    )
    return MAX_RENT


async def get_max_rent(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().replace(",", "").replace(".", "")
    if not text.isdigit() or not (100 <= int(text) <= 99999):
        await update.message.reply_text("⚠️ لطفاً یک عدد معتبر وارد کنید (مثال: 1200):")
        return MAX_RENT
    ctx.user_data["maxRent"] = int(text)
    kb = ReplyKeyboardMarkup(ROOMS_OPTIONS, one_time_keyboard=True, resize_keyboard=True)
    await update.message.reply_text("تعداد اتاق‌های مورد نیاز:", reply_markup=kb)
    return ROOMS


async def get_rooms(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["rooms"] = update.message.text.strip()
    await update.message.reply_text(
        "تاریخ نقل مکان (به فرمت YYYY-MM-DD):\n_(مثال: 2025-09-01)_",
        parse_mode="Markdown",
        reply_markup=ReplyKeyboardRemove(),
    )
    return MOVE_DATE


async def get_move_date(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    import re
    text = update.message.text.strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        await update.message.reply_text("⚠️ فرمت تاریخ باید YYYY-MM-DD باشد (مثال: 2025-09-01):")
        return MOVE_DATE
    ctx.user_data["moveDate"] = text
    kb = ReplyKeyboardMarkup(
        [["رد کردن ⏩"]], one_time_keyboard=True, resize_keyboard=True
    )
    await update.message.reply_text(
        "توضیح اضافی دارید؟ (اختیاری)\n"
        "_(مثال: غیرسیگاری هستم، کار از راه دور دارم...)_\n"
        "یا «رد کردن» را بزنید.",
        parse_mode="Markdown",
        reply_markup=kb,
    )
    return EXTRA_NOTE


async def get_extra_note(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    ctx.user_data["extraNote"] = "" if "رد" in text else text

    summary = profile_summary(ctx.user_data)
    kb = ReplyKeyboardMarkup(
        [["✅ تأیید و ساخت متن", "🔄 شروع مجدد"]],
        one_time_keyboard=True,
        resize_keyboard=True,
    )
    await update.message.reply_text(
        f"*خلاصه اطلاعات شما:*\n\n{summary}\n\nآیا اطلاعات درست است؟",
        parse_mode="Markdown",
        reply_markup=kb,
    )
    return CONFIRM


async def confirm(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    if "شروع" in update.message.text or "مجدد" in update.message.text:
        return await start(update, ctx)

    await update.message.reply_text(
        "⏳ در حال ساخت متن درخواست...",
        reply_markup=ReplyKeyboardRemove(),
    )

    data = dict(ctx.user_data)
    data["telegramUserId"] = str(update.effective_user.id)

    result = await call_backend("generate-anschreiben", data)

    if not result or "anschreiben" not in result:
        await update.message.reply_text(
            "❌ متأسفانه خطایی رخ داد. لطفاً دوباره امتحان کنید (/start)."
        )
        return ConversationHandler.END

    anschreiben = result["anschreiben"]
    ctx.user_data["anschreiben"] = anschreiben

    await update.message.reply_text(
        f"✅ *متن درخواست آماده شد:*\n\n```\n{anschreiben}\n```",
        parse_mode="Markdown",
    )

    # Premium upsell — Fix 6: no scraping or auto-apply promises
    await update.message.reply_text(
        "💡 *نسخه پریمیوم:*\n"
        "🔔 هشدار آگهی‌های جدید در حال آماده‌سازی است.\n"
        "📁 Bewerbungsmappe کامل و حرفه‌ای\n"
        "📊 پیگیری وضعیت درخواست‌ها\n\n"
        "💶 قیمت: *۹.۹۹€ / ماه*\n\n"
        "چه کار دیگری می‌خواهید انجام دهید؟",
        parse_mode="Markdown",
        reply_markup=main_keyboard(),
    )
    return ConversationHandler.END


# ── Callback queries ──────────────────────────────────────────

async def callback_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()

    if query.data == "new_application":
        await query.message.reply_text(
            "برای شروع دوباره /start را بزنید."
        )

    elif query.data == "get_pdf":
        anschreiben = ctx.user_data.get("anschreiben")
        if not anschreiben:
            await query.message.reply_text(
                "ابتدا یک متن درخواست بسازید (/start)."
            )
            return

        await query.message.reply_text("⏳ در حال ساخت PDF...")

        payload = dict(ctx.user_data)
        payload["anschreiben"] = anschreiben

        pdf_bytes = await download_pdf(payload)
        if not pdf_bytes:
            await query.message.reply_text("❌ خطا در ساخت PDF. دوباره امتحان کنید.")
            return

        filename = (
            f"Bewerbungsmappe_{ctx.user_data.get('lastName', 'User')}"
            f"_{ctx.user_data.get('firstName', '')}.pdf"
        )
        # Fix 3 — wrap bytes in BytesIO; raw bytes are not accepted by reply_document
        file_obj = BytesIO(pdf_bytes)
        file_obj.name = filename
        await query.message.reply_document(
            document=file_obj,
            filename=filename,
            caption="📁 *Bewerbungsmappe* شما آماده است!",
            parse_mode="Markdown",
        )

    elif query.data == "premium_info":
        await query.message.reply_text(
            "⚡ *نسخه پریمیوم*\n\n"
            "🔔 هشدار آگهی‌های جدید — در حال آماده‌سازی\n"
            "📁 Bewerbungsmappe کامل و حرفه‌ای\n"
            "📊 پیگیری وضعیت درخواست‌ها\n\n"
            "💶 قیمت: *۹.۹۹€ / ماه*\n\n"
            "برای اطلاع از راه‌اندازی، دکمه زیر را بزنید:",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([
                [InlineKeyboardButton("🔔 اطلاع‌رسانی کن", callback_data="notify_premium")]
            ]),
        )

    elif query.data == "notify_premium":
        await query.message.reply_text(
            "✅ ثبت شد! به محض راه‌اندازی پریمیوم به شما خبر می‌دهیم."
        )


# ── Cancel ────────────────────────────────────────────────────

async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text(
        "لغو شد. برای شروع دوباره /start را بزنید.",
        reply_markup=ReplyKeyboardRemove(),
    )
    return ConversationHandler.END


# ── Main ──────────────────────────────────────────────────────

def main() -> None:
    if not BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not set in .env")

    app = Application.builder().token(BOT_TOKEN).build()

    conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            FIRST_NAME:  [MessageHandler(filters.TEXT & ~filters.COMMAND, get_first_name)],
            LAST_NAME:   [MessageHandler(filters.TEXT & ~filters.COMMAND, get_last_name)],
            JOB:         [MessageHandler(filters.TEXT & ~filters.COMMAND, get_job)],
            INCOME:      [MessageHandler(filters.TEXT & ~filters.COMMAND, get_income)],
            FAMILY_SIZE: [MessageHandler(filters.TEXT & ~filters.COMMAND, get_family_size)],
            PETS:        [MessageHandler(filters.TEXT & ~filters.COMMAND, get_pets)],
            CITY:        [MessageHandler(filters.TEXT & ~filters.COMMAND, get_city)],
            MAX_RENT:    [MessageHandler(filters.TEXT & ~filters.COMMAND, get_max_rent)],
            ROOMS:       [MessageHandler(filters.TEXT & ~filters.COMMAND, get_rooms)],
            MOVE_DATE:   [MessageHandler(filters.TEXT & ~filters.COMMAND, get_move_date)],
            EXTRA_NOTE:  [MessageHandler(filters.TEXT & ~filters.COMMAND, get_extra_note)],
            CONFIRM:     [MessageHandler(filters.TEXT & ~filters.COMMAND, confirm)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True,
    )

    app.add_handler(conv)
    app.add_handler(CallbackQueryHandler(callback_handler))

    logger.info("🤖 Telegram bot started")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
