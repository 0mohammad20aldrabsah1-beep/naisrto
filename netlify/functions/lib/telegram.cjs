const { BOT_TOKEN, CHAT_ID } = require("../../../telegram-config.cjs");

function nowAr() {
  return new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" });
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

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

async function sendTelegramPhoto(base64, filename, caption) {
  const bytes = Buffer.from(base64, "base64");
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

module.exports = { nowAr, sendTelegram, sendTelegramPhoto, jsonResponse };
