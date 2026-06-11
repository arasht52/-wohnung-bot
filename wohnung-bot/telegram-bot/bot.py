import os, logging, threading, http.server, socketserver, re
from io import BytesIO
import httpx
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler, ConversationHandler, filters, ContextTypes

load_dotenv()
logging.basicConfig(format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3001")
PORT = int(os.getenv("PORT", 8080))

FIRST_NAME, LAST_NAME, JOB, INCOME, FAMILY_SIZE, PETS, CITY, MAX_RENT, ROOMS, MOVE_DATE, EXTRA_NOTE, CONFIRM = range(12)

CITIES = [["Hamburg","Berlin","München"],["Frankfurt","Köln","Stuttgart"],["Düsseldorf","Leipzig","Bremen"],["Hannover","Nürnberg","Dresden"]]
ROOMS_OPTIONS = [["1","1.5","2"],["2.5","3","3.5"],["4","4+"]]

class SilentHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200); self.end_headers(); self.wfile.write(b"OK")
    def log_message(self, format, *args): pass

def start_health_server():
    with socketserver.TCPServer(("", PORT), SilentHandler) as s: s.serve_forever()

def profile_summary(d):
    pets = "بله" if d.get("hasPets") else "خیر"
    return f"👤 *{d['firstName']} {d['lastName']}*\n💼 {d['job']}\n💶 {d['income']}€\n👨‍👩‍👧 {d['familySize']} نفر | حیوان: {pets}\n📍 {d['city']}\n🏠 تا {d['maxRent']}€ | {d['rooms']} اتاق\n📅 {d['moveDate']}\n"

def main_keyboard():
    return InlineKeyboardMarkup([[InlineKeyboardButton("📋 متن جدید", callback_data="new_application")],[InlineKeyboardButton("📁 PDF", callback_data="get_pdf")],[InlineKeyboardButton("⚡ پریمیوم", callback_data="premium_info")]])

async def call_backend(endpoint, payload):
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{BACKEND_URL}/api/{endpoint}", json=payload); r.raise_for_status(); return r.json()
    except Exception as e:
        logger.error("Backend: %s", e); return None

async def download_pdf(payload):
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(f"{BACKEND_URL}/api/generate-bewerbungsmappe", json=payload); r.raise_for_status(); return r.content
    except Exception as e:
        logger.error("PDF: %s", e); return None

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data.clear()
    await update.message.reply_text("سلام! 👋 به *WohnRadar* خوش آمدید\n\nمتن درخواست اجاره حرفه‌ای آلمانی در چند ثانیه\n\nلطفاً *نام* خود را وارد کنید:", parse_mode="Markdown", reply_markup=ReplyKeyboardRemove())
    return FIRST_NAME

async def get_first_name(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["firstName"] = update.message.text.strip()
    await update.message.reply_text("نام خانوادگی:"); return LAST_NAME

async def get_last_name(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["lastName"] = update.message.text.strip()
    await update.message.reply_text("شغل (آلمانی یا انگلیسی):\n_مثال: Softwareentwickler_", parse_mode="Markdown"); return JOB

async def get_job(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["job"] = update.message.text.strip()
    await update.message.reply_text("درآمد ماهانه خالص (€):\n_فقط عدد، مثال: 2500_", parse_mode="Markdown"); return INCOME

async def get_income(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().replace(",","").replace(".","")
    if not text.isdigit() or not (100 <= int(text) <= 99999):
        await update.message.reply_text("⚠️ عدد معتبر وارد کنید (مثال: 2500):"); return INCOME
    ctx.user_data["income"] = int(text)
    await update.message.reply_text("تعداد نفرات خانوار:", reply_markup=ReplyKeyboardMarkup([["1","2","3"],["4","5","6+"]], one_time_keyboard=True, resize_keyboard=True)); return FAMILY_SIZE

async def get_family_size(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().replace("+","")
    if not text.isdigit() or not (1 <= int(text) <= 10):
        await update.message.reply_text("⚠️ عدد ۱ تا ۱۰:"); return FAMILY_SIZE
    ctx.user_data["familySize"] = int(text)
    await update.message.reply_text("حیوان خانگی؟", reply_markup=ReplyKeyboardMarkup([["بله ✅","خیر ❌"]], one_time_keyboard=True, resize_keyboard=True)); return PETS

async def get_pets(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["hasPets"] = "بله" in update.message.text
    await update.message.reply_text("شهر:", reply_markup=ReplyKeyboardMarkup(CITIES, one_time_keyboard=True, resize_keyboard=True)); return CITY

async def get_city(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["city"] = update.message.text.strip()
    await update.message.reply_text("حداکثر اجاره (€/ماه):\n_مثال: 1200_", parse_mode="Markdown", reply_markup=ReplyKeyboardRemove()); return MAX_RENT

async def get_max_rent(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip().replace(",","").replace(".","")
    if not text.isdigit() or not (100 <= int(text) <= 99999):
        await update.message.reply_text("⚠️ عدد معتبر (مثال: 1200):"); return MAX_RENT
    ctx.user_data["maxRent"] = int(text)
    await update.message.reply_text("تعداد اتاق:", reply_markup=ReplyKeyboardMarkup(ROOMS_OPTIONS, one_time_keyboard=True, resize_keyboard=True)); return ROOMS

async def get_rooms(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    ctx.user_data["rooms"] = update.message.text.strip()
    await update.message.reply_text("تاریخ نقل مکان (YYYY-MM-DD):\n_مثال: 2025-09-01_", parse_mode="Markdown", reply_markup=ReplyKeyboardRemove()); return MOVE_DATE

async def get_move_date(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", text):
        await update.message.reply_text("⚠️ فرمت: YYYY-MM-DD"); return MOVE_DATE
    ctx.user_data["moveDate"] = text
    await update.message.reply_text("توضیح اضافی؟ (اختیاری)\n_یا «رد» بزنید_", parse_mode="Markdown", reply_markup=ReplyKeyboardMarkup([["رد ⏩"]], one_time_keyboard=True, resize_keyboard=True)); return EXTRA_NOTE

async def get_extra_note(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    text = update.message.text.strip()
    ctx.user_data["extraNote"] = "" if "رد" in text else text
    await update.message.reply_text(f"*خلاصه:*\n\n{profile_summary(ctx.user_data)}\nتأیید؟", parse_mode="Markdown", reply_markup=ReplyKeyboardMarkup([["✅ تأیید","🔄 شروع مجدد"]], one_time_keyboard=True, resize_keyboard=True)); return CONFIRM

async def confirm(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    if "شروع" in update.message.text: return await start(update, ctx)
    await update.message.reply_text("⏳ در حال ساخت...", reply_markup=ReplyKeyboardRemove())
    data = dict(ctx.user_data); data["telegramUserId"] = str(update.effective_user.id)
    result = await call_backend("generate-anschreiben", data)
    if not result or "anschreiben" not in result:
        await update.message.reply_text("❌ خطا. دوباره امتحان کنید (/start)."); return ConversationHandler.END
    anschreiben = result["anschreiben"]; ctx.user_data["anschreiben"] = anschreiben
    await update.message.reply_text(f"✅ *متن آماده:*\n\n```\n{anschreiben}\n```", parse_mode="Markdown")
    await update.message.reply_text("چه کار دیگری؟", reply_markup=main_keyboard()); return ConversationHandler.END

async def callback_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query; await query.answer()
    if query.data == "new_application":
        await query.message.reply_text("برای شروع /start بزنید.")
    elif query.data == "get_pdf":
        anschreiben = ctx.user_data.get("anschreiben")
        if not anschreiben: await query.message.reply_text("ابتدا متن بسازید (/start)."); return
        await query.message.reply_text("⏳ ساخت PDF...")
        payload = dict(ctx.user_data); payload["anschreiben"] = anschreiben
        pdf_bytes = await download_pdf(payload)
        if not pdf_bytes: await query.message.reply_text("❌ خطا در PDF."); return
        filename = f"Bewerbungsmappe_{ctx.user_data.get('lastName','User')}.pdf"
        f = BytesIO(pdf_bytes); f.name = filename
        await query.message.reply_document(document=f, filename=filename, caption="📁 PDF آماده!")
    elif query.data == "premium_info":
        await query.message.reply_text("⚡ *پریمیوم*\n\n🔔 هشدار آگهی — در حال آماده‌سازی\n📁 PDF کامل\n\n💶 ۹.۹۹€/ماه", parse_mode="Markdown", reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔔 اطلاع‌رسانی", callback_data="notify")]]))
    elif query.data == "notify":
        await query.message.reply_text("✅ ثبت شد!")

async def cancel(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> int:
    await update.message.reply_text("لغو شد. /start برای شروع.", reply_markup=ReplyKeyboardRemove()); return ConversationHandler.END

def main():
    if not BOT_TOKEN: raise RuntimeError("TELEGRAM_BOT_TOKEN not set")
    threading.Thread(target=start_health_server, daemon=True).start()
    logger.info("Health server on port %d", PORT)
    app = Application.builder().token(BOT_TOKEN).build()
    conv = ConversationHandler(
        entry_points=[CommandHandler("start", start)],
        states={
            FIRST_NAME:[MessageHandler(filters.TEXT & ~filters.COMMAND, get_first_name)],
            LAST_NAME:[MessageHandler(filters.TEXT & ~filters.COMMAND, get_last_name)],
            JOB:[MessageHandler(filters.TEXT & ~filters.COMMAND, get_job)],
            INCOME:[MessageHandler(filters.TEXT & ~filters.COMMAND, get_income)],
            FAMILY_SIZE:[MessageHandler(filters.TEXT & ~filters.COMMAND, get_family_size)],
            PETS:[MessageHandler(filters.TEXT & ~filters.COMMAND, get_pets)],
            CITY:[MessageHandler(filters.TEXT & ~filters.COMMAND, get_city)],
            MAX_RENT:[MessageHandler(filters.TEXT & ~filters.COMMAND, get_max_rent)],
            ROOMS:[MessageHandler(filters.TEXT & ~filters.COMMAND, get_rooms)],
            MOVE_DATE:[MessageHandler(filters.TEXT & ~filters.COMMAND, get_move_date)],
            EXTRA_NOTE:[MessageHandler(filters.TEXT & ~filters.COMMAND, get_extra_note)],
            CONFIRM:[MessageHandler(filters.TEXT & ~filters.COMMAND, confirm)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True,
    )
    app.add_handler(conv)
    app.add_handler(CallbackQueryHandler(callback_handler))
    logger.info("Bot started")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
