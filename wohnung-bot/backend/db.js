/**
 * db.js — Pure-JS JSON storage via lowdb v7.
 *
 * Why lowdb instead of better-sqlite3?
 *   better-sqlite3 requires native C++ compilation (node-gyp).
 *   On some environments (Render free tier, ARM, older glibc) the build fails.
 *   lowdb is pure JavaScript, zero native deps, works everywhere with npm install.
 */

import { LowSync } from "lowdb";
import { JSONFileSync } from "lowdb/node";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, "data");
const DB_PATH   = join(DATA_DIR, "db.json");

/** @type {LowSync} */
let db;

export function initDb() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const adapter = new JSONFileSync(DB_PATH);
  db = new LowSync(adapter, { users: [] });
  db.read();
  db.data.users ??= [];
  db.write();
  console.log("✅ Database initialized (lowdb JSON)");
}

function getDb() {
  if (!db) throw new Error("DB not initialized — call initDb() first");
  return db;
}

export function upsertUser(data) {
  const store = getDb();
  store.read();

  const now   = new Date().toISOString();
  const index = store.data.users.findIndex(
    (u) => u.telegramUserId === data.telegramUserId
  );

  const record = {
    telegramUserId: data.telegramUserId,
    firstName:      data.firstName,
    lastName:       data.lastName,
    job:            data.job,
    income:         data.income,
    familySize:     data.familySize,
    hasPets:        !!data.hasPets,
    city:           data.city,
    maxRent:        data.maxRent,
    rooms:          data.rooms,
    moveDate:       data.moveDate,
    extraNote:      data.extraNote || null,
    premiumStatus:  false,
    updatedAt:      now,
  };

  if (index === -1) {
    store.data.users.push({ ...record, createdAt: now });
  } else {
    store.data.users[index] = { ...store.data.users[index], ...record };
  }

  store.write();
}

export function getUserByTelegramId(telegramUserId) {
  const store = getDb();
  store.read();
  return store.data.users.find((u) => u.telegramUserId === telegramUserId) ?? null;
}
