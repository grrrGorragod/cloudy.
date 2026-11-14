import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { q, initSchema } from "./db.js";
import { auth } from "./auth.js";
import { router } from "./routes.js";

for (const k of ["DATABASE_URL", "OPENAI_API_KEY"]) {
  if (!process.env[k]) {
    console.error(`Missing env ${k}`);
    process.exit(1);
  }
}

const app = express();
app.set("trust proxy", 1); // อยู่หลัง proxy ของ Render
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "DELETE"]
  })
);
app.use(express.json({ limit: "20kb" }));

// ใช้ให้บริการเฝ้าเว็บ (เช่น UptimeRobot) ยิงตรวจ: ตอบ 200 เมื่อเซิร์ฟเวอร์และฐานข้อมูลปกติ, 503 เมื่อฐานข้อมูลไม่ตอบ
app.get("/healthz", async (_req, res) => {
  try {
    await q("SELECT 1");
    res.json({ ok: true });
  } catch (e) {
    console.error("healthz db failed:", e.message);
    res.status(503).json({ ok: false });
  }
});

// rate limit เก็บในหน่วยความจำเท่านั้น ไม่บันทึก IP ลงฐานข้อมูล
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: "draft-7", legacyHeaders: false }));
app.use("/api", auth, router);

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
    return res.status(400).json({ error: "bad_request" });
  }
  console.error("server error:", err.message); // ไม่ log เนื้อหาที่ผู้ใช้ส่งมา
  res.status(500).json({ error: "server_error" });
});

// ลบโพสที่หมดอายุทิ้งจริง (คำตอบ ห่วงใย รายงาน ถูกลบตามด้วย cascade)
const cleanup = () =>
  q("DELETE FROM posts WHERE expires_at < now()").catch((e) => console.error("cleanup failed:", e.message));

await initSchema();
await cleanup();
setInterval(cleanup, 30 * 60 * 1000).unref();

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`listening on ${port}`));
