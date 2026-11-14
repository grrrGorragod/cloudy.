// แจ้งเตือนแอดมินผ่าน Discord webhook (ตั้ง DISCORD_WEBHOOK_URL ใน env; ถ้าไม่ตั้งจะข้ามเงียบๆ)
// ไม่ส่งเนื้อหาของผู้ใช้ออกไปนอกระบบ ส่งแค่ประเภท/เลข id/จำนวนรายงาน แล้วให้ไปดูเนื้อหาผ่าน `npm run admin`
const URL_ = process.env.DISCORD_WEBHOOK_URL;
if (!URL_) console.warn("[notify] DISCORD_WEBHOOK_URL ไม่ได้ตั้ง จะไม่มีการแจ้งเตือนแอดมิน");

export async function notifyHidden(kind, id, reportCount) {
  if (!URL_) return;
  const label = kind === "post" ? "โพส" : "คำตอบ";
  try {
    const res = await fetch(URL_, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "ที่ระบาย",
        allowed_mentions: { parse: [] },
        content:
          `⚠️ ${label} #${id} ถูกซ่อนอัตโนมัติ (ถูกรายงาน ${reportCount} ครั้ง)\n` +
          `ดูเนื้อหา:  npm run admin -- show ${kind} ${id}\n` +
          `อนุมัติ:    npm run admin -- approve ${kind} ${id}\n` +
          `ลบถาวร:    npm run admin -- delete ${kind} ${id}`
      }),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) console.error("[notify] discord webhook http", res.status, await res.text().catch(() => ""));
    else console.log(`[notify] ส่งแจ้งเตือน ${kind} #${id} แล้ว`);
  } catch (e) {
    console.error("[notify] discord webhook failed:", e.message); // แจ้งไม่ได้ก็ไม่ให้กระทบการรายงาน
  }
}