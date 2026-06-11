import TelegramBot from 'node-telegram-bot-api';
import { upsertUser } from '../../db.js';
import { generateAnschreiben } from '../../backend/services/claudeService.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const BASE_URL = process.env.PUBLIC_BASE_URL || '';


export const bot = new TelegramBot(TOKEN, { webHook: true });

const sessions = {};
const STEPS = ['firstName','lastName','job','income','familySize','pets','city','maxRent','rooms','moveDate','extraNote','confirm'];

const PROMPTS = {
  firstName: '👋 خوش آمدید به WohnRadar!

*نام* شما چیست؟',
  lastName: '*نام خانوادگی* شما چیست؟',
  job: '*شغل* شما چیست؟',
  income: '*درآمد خالص ماهانه* چقدر است؟ (یورو)
_(فقط عدد، مثلاً 2500)_',
  familySize: 'چند نفر *اسباب کشی* می کنند؟',
  pets: 'آیا *حیوان خانگی* دارید؟',
  city: 'در کدام *شهر* آلمان دنبال خانه می گردید؟',
  maxRent: 'حداکثر *اجاره ماهانه* چقدر است؟ (یورو)
_(فقط عدد، مثلاً 1200)_',
  rooms: 'چند *اتاق* نیاز دارید؟',
  moveDate: 'تاریخ *اسباب کشی* چیست؟
_(مثلاً 01.08.2025 یا هر چه زودتر)_',
  extraNote: 'آیا *نکته مهمی* هست؟
_(اختیاری - برای رد کردن - بزنید)_',
};

const KB = {
  familySize: { reply_markup: { keyboard: [['1'],['2'],['3'],['4+']], one_time_keyboard: true, resize_keyboard: true } },
  pets: { reply_markup: { keyboard: [['بله'],['خیر']], one_time_keyboard: true, resize_keyboard: true } },
  rooms: { reply_markup: { keyboard: [['1'],['2'],['2.5'],['3'],['3.5'],['4+']], one_time_keyboard: true, resize_keyboard: true } },
  confirm: { reply_markup: { keyboard: [['بله تایید میکنم'],['خیر از اول']], one_time_keyboard: true, resize_keyboard: true } },
  extraNote: { reply_markup: { keyboard: [['-']], one_time_keyboard: true, resize_keyboard: true } },
};

const RK = { reply_markup: { remove_keyboard: true } };

function resetSession(id) { sessions[id] = { step: STEPS[0], data: {} }; }

function buildSummary(d) {
  return '📋 *خلاصه اطلاعات شما:*

' +
    '👤 نام: ' + d.firstName + ' ' + d.lastName + '
' +
    '💼 شغل: ' + d.job + '
' +
    '💰 درآمد: ' + d.income + ' یورو/ماه
' +
    '👨‍👩‍👧 تعداد نفرات: ' + d.familySize + '
' +
    '🐾 حیوان خانگی: ' + (d.pets ? 'بله' : 'خیر') + '
' +
    '📍 شهر: ' + d.city + '
' +
    '🏠 حداکثر اجاره: ' + d.maxRent + ' یورو
' +
    '🚪 تعداد اتاق: ' + d.rooms + '
' +
    '📅 اسباب کشی: ' + d.moveDate +
    (d.extraNote && d.extraNote !== '-' ? '
📝 توضیحات: ' + d.extraNote : '') +
    '

آیا اطلاعات صحیح است؟';
}

async function sendStep(chatId, step, data) {
  const opts = { parse_mode: 'Markdown', ...(KB[step] || RK) };
  await bot.sendMessage(chatId, step === 'confirm' ? buildSummary(data) : PROMPTS[step], opts);
}

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const text = (msg.text || '').trim();

  if (text === '/start') {
    resetSession(userId);
    await bot.sendMessage(chatId, '🏠 *WohnRadar - دستیار یافتن خانه در آلمان*

برای نوشتن نامه درخواست اجاره به چند سوال پاسخ دهید.', { parse_mode: 'Markdown', ...RK });
    await sendStep(chatId, STEPS[0], {});
    return;
  }
  if (text === '/cancel') {
    sessions[userId] = { step: null, data: {} };
    await bot.sendMessage(chatId, 'لغو شد. برای شروع /start بزنید.', RK);
    return;
  }

  const session = getSession(userId);

  const step = session.step;

  if (step === 'income' || step === 'maxRent') {
    const num = parseFloat(text.replace(/[^d.]/g, ''));
    if (isNaN(num) || num <= 0) { await bot.sendMessage(chatId, 'لطفاً یک عدد معتبر وارد کنید.'); return; }
    session.data[step] = num;
  } else if (step === 'familySize') {
    const num = parseInt(text.replace(/[^d]/g, '')) || (text.includes('4') ? 4 : NaN);
    if (isNaN(num) || num < 1) { await bot.sendMessage(chatId, 'لطفاً تعداد نفرات را وارد کنید.'); return; }
    session.data[step] = num;
  } else if (step === 'rooms') {
    const num = parseFloat(text.replace(/[^d.]/g, ''));
    if (isNaN(num) || num < 1) { await bot.sendMessage(chatId, 'لطفاً تعداد اتاق را وارد کنید.'); return; }
    session.data[step] = num;
  } else if (step === 'pets') {
    const yes = text === 'بله' || text.toLowerCase() === 'ja';
    const no = text === 'خیر' || text.toLowerCase() === 'nein';
    session.data[step] = yes;
  } else if (step === 'confirm') {
    const yes = text.includes('بله') || text.toLowerCase() === 'ja';
    const no = text.includes('خیر') || text.toLowerCase() === 'nein';
    if (no) { resetSession(userId); await bot.sendMessage(chatId, 'از ابتدا شروع میکنیم!'); await sendStep(chatId, STEPS[0], {}); return; }
    await bot.sendMessage(chatId, 'در حال نوشتن نامه... لطفاً صبر کنید.', RK);
    try {
      const profileData = { ...session.data, telegramUserId: userId, hasPets: session.data.pets };
      upsertUser(profileData);
      const anschreiben = await generateAnschreiben(profileData);
      await bot.sendMessage(chatId, '*نامه درخواست شما:*

' + anschreiben, { parse_mode: 'Markdown' });
      await bot.sendMessage(chatId, 'نامه آماده است! برای نامه جدید /start بزنید.

💎 بزودی: ارسال PDF به ایمیل!', { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Anschreiben error:', err.message);
      await bot.sendMessage(chatId, 'خطا در نوشتن نامه. دوباره /start بزنید.');
    }
    sessions[userId] = { step: null, data: {} };
    return;
  } else {
    session.data[step] = text;
  }

  const nextStep = STEPS[STEPS.indexOf(step) + 1];
  session.step = nextStep;
  await sendStep(chatId, nextStep, session.data);
});

export async function setupWebhook() {
  try {
    const opts = SECRET ? { secret_token: SECRET } : {};
    await bot.setWebHook(BASE_URL + '/telegram/webhook', opts);
    console.log('Telegram webhook set: ' + BASE_URL + '/telegram/webhook');
  } catch (err) { console.error('Webhook setup failed:', err.message); }
}

export function telegramWebhookHandler(req, res) {
  if (SECRET) {
    const incoming = req.headers['x-telegram-bot-api-secret-token'];
    if (incoming !== SECRET) return res.status(403).json({ error: 'Forbidden' });
  }
  bot.processUpdate(req.body);
  res.sendStatus(200);
}