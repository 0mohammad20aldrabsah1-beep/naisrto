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

module.exports = { nowAr, sendTelegram, jsonResponse };
