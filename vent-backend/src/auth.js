import crypto from "node:crypto";
import { q } from "./db.js";

// กุญแจสร้างจากฝั่ง browser ต้องสุ่มให้ได้ความยาวอย่างน้อย ~128 บิต (เช่น base32 26 ตัวอักษร)
// ส่งมาทาง header:  Authorization: Bearer <key>
const KEY_RE = /^[A-Za-z0-9-]{26,80}$/;

export const hashKey = (key) =>
  crypto.createHash("sha256").update(key.replace(/-/g, "").toLowerCase()).digest("hex");

function readKey(req) {
  const m = /^Bearer (.+)$/.exec(req.get("authorization") || "");
  return m && KEY_RE.test(m[1]) ? m[1] : null;
}

// ใส่ req.keyHash และ req.user (ถ้ามีบัญชีแล้ว) ให้ทุก request; ไม่บังคับ
export async function auth(req, _res, next) {
  const key = readKey(req);
  req.keyHash = key ? hashKey(key) : null;
  req.user = null;
  if (req.keyHash) {
    const { rows } = await q("SELECT id, name, tag FROM users WHERE key_hash = $1", [req.keyHash]);
    req.user = rows[0] || null;
  }
  next();
}

export const requireKey = (req, res, next) =>
  req.keyHash ? next() : res.status(401).json({ error: "invalid_key" });

export const requireUser = (req, res, next) =>
  req.user ? next() : res.status(401).json({ error: "unauthorized" });
