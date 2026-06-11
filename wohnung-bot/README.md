# 🏠 Wohnung Bot — MVP v2.1

ابزار ساخت متن درخواست اجاره خانه آلمانی برای فارسی‌زبانان ساکن آلمان.

---

## معماری

```
wohnung-bot/
├── backend/          Node.js 20 + Express + lowdb (JSON)
│   ├── server.js
│   ├── db.js
│   ├── routes/
│   │   ├── anschreiben.js
│   │   └── bewerbungsmappe.js
│   ├── services/
│   │   ├── claudeService.js    ← Claude API (فقط اینجا)
│   │   └── pdfService.js       ← PDFKit
│   └── middleware/
│       └── validate.js
│
├── telegram-bot/     Python + python-telegram-bot
│   ├── bot.py
│   └── requirements.txt
│
└── frontend/         React
    └── src/App.jsx
```

---

## راه‌اندازی

### ۱. Backend

```bash
cd backend
cp .env.example .env
# مقادیر .env را پر کنید

npm install        # بدون native build — کار می‌کند روی هر سیستم
npm start
# اجرا روی port 3001
```

> نیاز به Node.js نسخه ۲۰ یا بالاتر (`node --version`)

### ۲. Telegram Bot

```bash
cd telegram-bot
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate

pip install -r requirements.txt

# فایل .env را از backend کپی کنید
python bot.py
```

### ۳. Frontend

```bash
cd frontend
cp .env.example .env
# REACT_APP_BACKEND_URL=http://localhost:3001

npm install
npm start
```

---

## متغیرهای محیطی (`backend/.env`)

| متغیر | توضیح | پیش‌فرض |
|---|---|---|
| `ANTHROPIC_API_KEY` | کلید API از console.anthropic.com | الزامی |
| `ANTHROPIC_MODEL` | مدل Claude | `claude-sonnet-4-20250514` |
| `TELEGRAM_BOT_TOKEN` | توکن از BotFather | الزامی |
| `PORT` | پورت backend | `3001` |
| `FRONTEND_URL` | آدرس frontend برای CORS | `http://localhost:3000` |
| `BACKEND_URL` | آدرس backend برای بات | `http://localhost:3001` |

---

## API Endpoints

### `POST /api/generate-anschreiben`
```json
{
  "firstName": "Ali", "lastName": "Rezaei",
  "job": "Softwareentwickler", "income": 3200,
  "familySize": 2, "hasPets": false,
  "city": "Hamburg", "maxRent": 1400,
  "rooms": "2", "moveDate": "2025-09-01",
  "extraNote": "Nichtraucher"
}
// → { "anschreiben": "Sehr geehrte Damen und Herren, ..." }
```

### `POST /api/generate-bewerbungsmappe`
همان payload + `"anschreiben": "..."` → دانلود PDF

---

## ذخیره‌سازی

`lowdb` JSON در `backend/data/db.json` — خودکار ساخته می‌شود.
بدون native dependency، روی همه سیستم‌ها کار می‌کند.

---

## Known MVP limitations

- **هشدار آگهی** (Wohnungs-Alerts): در حال آماده‌سازی است — هنوز فعال نیست.
- **اسکرپینگ مستقیم** ImmoScout24 یا Kleinanzeigen: پیاده‌سازی نشده.
- **ارسال خودکار درخواست** (Auto-apply): پیاده‌سازی نشده.
- **پرداخت / Stripe**: پیاده‌سازی نشده — placeholder فقط.
- **PDF**: یک قالب پایه Bewerbungsmappe است، نه سیستم تأیید مدارک.
- **آپلود مدارک توسط کاربر**: پشتیبانی نمی‌شود.
- **احراز هویت**: وجود ندارد — مناسب برای MVP با ۱۰ کاربر کنترل‌شده.

---

## Changelog

### v2.1.0
| # | Fix | توضیح |
|---|---|---|
| 1 | **Node version** | `engines.node >= 20` در package.json |
| 1 | **SQLite → lowdb** | `better-sqlite3` (native C++) با `lowdb` (pure JS) جایگزین شد — `npm install` بدون مشکل |
| 1 | **ESM** | تمام فایل‌های backend به ES Module تبدیل شد (`"type": "module"`) |
| 2 | **Rate limiting دوگانه** | `ipLimiter` برای browser traffic، `telegramLimiter` برای bot requests — کلید محدودیت: `telegramUserId` |
| 3 | **PDF در تلگرام** | `BytesIO` wrapper اضافه شد — `raw bytes` مستقیماً ارسال نمی‌شود |
| 4 | **Font safety** | `☑` و `☐` با `[x]` و `[ ]` جایگزین شد — از مشکل encoding در PDFKit جلوگیری می‌کند |
| 5 | **Model config** | مدل Claude از `.env` خوانده می‌شود (`ANTHROPIC_MODEL`) با fallback |
| 6 | **Premium wording** | تمام اشاره به "اسکرپینگ ImmoScout24"، "ارسال خودکار" حذف و با "هشدار آگهی در حال آماده‌سازی" جایگزین شد |
| 7 | **README** | بخش "Known MVP limitations" اضافه شد |

---

## قدم بعدی

1. Deploy backend روی Render.com یا Railway
2. تست با ۱۰ نفر واقعی از طریق بات تلگرام
3. جمع‌آوری فیدبک
4. سپس پیاده‌سازی سیستم هشدار آگهی

---

*Wohnung Bot — نسخه ۲.۱ — ساخته‌شده برای فارسی‌زبانان آلمان*
