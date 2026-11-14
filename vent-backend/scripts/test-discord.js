// ยิงข้อความทดสอบเข้า Discord webhook ตรงๆ เพื่อเช็คว่า URL ใช้ได้ไหม
// ใช้:  npm run test-discord
const url = process.env.DISCORD_WEBHOOK_URL;
if (!url) {
  console.log("✗ ไม่พบ DISCORD_WEBHOOK_URL (เช็คว่าอยู่ใน .env และสะกดชื่อตัวแปรถูก)");
  process.exit(1);
}
console.log("URL ขึ้นต้นด้วย:", url.slice(0, 36) + "…  (ควรเป็น https://discord.com/api/webhooks/)");
try {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ที่ระบาย", content: "✅ ทดสอบการแจ้งเตือนแอดมิน" }),
    signal: AbortSignal.timeout(8000)
  });
  console.log("HTTP", res.status, res.ok ? "✓ ส่งสำเร็จ ดูในช่อง Discord ได้เลย" : "✗ " + (await res.text()));
} catch (e) {
  console.log("✗ ส่งไม่ได้:", e.message);
}