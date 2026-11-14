import pg from "pg";
import { readFileSync } from "node:fs";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon ต้องใช้ SSL; ตั้ง PGSSL=disable เฉพาะตอนรัน Postgres ในเครื่อง
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: true },
  max: 5,
  // Neon ปิดคอนเนกชันที่ว่างเองและหลับเมื่อไม่มีคนใช้: ให้ pool ทิ้งคอนเนกชันเก่าก่อนโดนตัด
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true
});

// ถ้าไม่มีตัวดักนี้ error ของคอนเนกชันที่ว่างอยู่ (เช่น Neon ตัดสาย) จะทำให้โปรเซสทั้งตัวตาย
// pool จะทิ้งคอนเนกชันนั้นแล้วเปิดใหม่เองในคำขอถัดไป
pool.on("error", (e) => console.error("pg idle client error:", e.message));

export const q = (text, params) => pool.query(text, params);

export async function initSchema() {
  const sql = readFileSync(new URL("../schema.sql", import.meta.url), "utf8");
  await pool.query(sql);
}
