import { Router } from "express";
import rateLimit from "express-rate-limit";
import crypto from "node:crypto";
import { q } from "./db.js";
import { requireKey, requireUser } from "./auth.js";
import { screen, MESSAGES } from "./moderation.js";
import { notifyHidden } from "./notify.js";

export const router = Router();

const DAYS = [1, 3, 7, 14]; // อายุโพสที่เลือกได้ สูงสุด 14 วัน
const MODES = ["free", "reactions"];
const PRESETS = ["ฉันอยู่ตรงนี้นะ", "ขอบคุณที่เล่าให้ฟัง", "เธอไม่ได้อยู่คนเดียว", "กอดๆ นะ"];
const RESERVED = ["admin", "administrator", "moderator", "แอดมิน", "ผู้ดูแล"];

const MAX_POSTS_PER_DAY = Number(process.env.MAX_POSTS_PER_DAY || 5);
const MAX_REPLIES_PER_HOUR = Number(process.env.MAX_REPLIES_PER_HOUR || 40);
const MAX_REPLIES_PER_POST = Number(process.env.MAX_REPLIES_PER_POST || 10);
const REPORT_HIDE_AT = Number(process.env.REPORT_HIDE_AT || 3);
// กันการรายงานกลั่นแกล้งด้วยบัญชีปลอม: บัญชีต้องมีอายุพอ และรายงานได้จำกัดต่อวัน
const REPORT_MIN_ACCOUNT_HOURS = Number(process.env.REPORT_MIN_ACCOUNT_HOURS || 24);
const REPORT_MAX_PER_DAY = Number(process.env.REPORT_MAX_PER_DAY || 10);

const isId = (v) => typeof v === "string" && /^\d{1,18}$/.test(v);
const display = (name, tag) => `${name}#${tag}`;

function cleanText(value, max) {
  if (typeof value !== "string") return null;
  const t = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!t || [...t].length > max) return null;
  return t;
}

function cleanName(value) {
  if (typeof value !== "string") return null;
  const n = value.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!/^[^\p{C}#@]{2,24}$/u.test(n)) return null;
  if (RESERVED.some((r) => n.toLowerCase().includes(r))) return null;
  return n;
}

// ตรวจข้อความ; ถ้าไม่ผ่านจะตอบกลับเองแล้วคืน null
async function guard(res, text) {
  try {
    const v = await screen(text);
    if (v.blocked) {
      res.status(422).json({ error: "blocked", reason: v.blocked, message: MESSAGES[v.blocked] });
      return null;
    }
    return v;
  } catch (e) {
    console.error("moderation error:", e.message);
    res.status(503).json({
      error: "moderation_unavailable",
      message: "ตอนนี้ระบบตรวจข้อความขัดข้อง ลองใหม่อีกครั้งในอีกสักครู่นะ ข้อความของคุณยังอยู่ในหน้าจอ"
    });
    return null;
  }
}

const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });

// ---------- config ----------
router.get("/config", (_req, res) => {
  res.json({
    presets: PRESETS,
    durations: DAYS,
    modes: MODES,
    helpline: { name: "สายด่วนสุขภาพจิต", number: "1323" }
  });
});

// ---------- account ----------
router.post("/register", registerLimiter, requireKey, async (req, res) => {
  if (req.user) {
    return res.status(409).json({ error: "already_registered", name: display(req.user.name, req.user.tag) });
  }
  const name = cleanName(req.body?.name);
  if (!name) {
    return res.status(400).json({ error: "invalid_name", message: "ชื่อต้องยาว 2-24 ตัวอักษร และห้ามมี # หรือ @" });
  }
  if (!(await guard(res, name))) return;

  for (let i = 0; i < 12; i++) {
    const tag = String(crypto.randomInt(0, 10000)).padStart(4, "0");
    try {
      const { rows } = await q(
        "INSERT INTO users (key_hash, name, tag) VALUES ($1, $2, $3) RETURNING name, tag",
        [req.keyHash, name, tag]
      );
      return res.status(201).json({ name: display(rows[0].name, rows[0].tag) });
    } catch (e) {
      if (e.code !== "23505") throw e;
      if (e.constraint !== "users_name_tag") return res.status(409).json({ error: "already_registered" });
      // รหัสท้ายชื่อชน ลองสุ่มใหม่
    }
  }
  res.status(503).json({ error: "name_busy", message: "ชื่อนี้มีคนใช้เยอะแล้ว ลองชื่ออื่นนะ" });
});

// ใช้ตอนย้ายเครื่อง: ใส่กุญแจเดิมแล้วได้ชื่อเดิมกลับมา
router.get("/me", requireUser, (req, res) => {
  res.json({ name: display(req.user.name, req.user.tag) });
});

// สรุปโพสของฉันที่ยังไม่หมดอายุ ใช้ทำแจ้งเตือน "มีคนตอบ/ห่วงใยใหม่"
// เซิร์ฟเวอร์ไม่เก็บว่าใครอ่านอะไรแล้ว (หน้าเว็บจำเองในเครื่อง) จึงไม่มีข้อมูลเพิ่มในฐานข้อมูล
// replies = คำตอบจากคนอื่น (ไม่นับที่เจ้าของโพสตอบเอง)
router.get("/me/posts", requireUser, async (req, res) => {
  const { rows } = await q(
    `SELECT p.id,
       (SELECT count(*)::int FROM replies r WHERE r.post_id = p.id AND NOT r.hidden AND r.user_id <> p.user_id) AS replies,
       (SELECT count(*)::int FROM care c WHERE c.post_id = p.id) AS cares
     FROM posts p
     WHERE p.user_id = $1 AND p.expires_at > now() AND NOT p.hidden
     ORDER BY p.created_at DESC`,
    [req.user.id]
  );
  res.json({ posts: rows });
});

// ---------- posts ----------
const POST_SQL = `
  SELECT p.id, p.user_id, p.content, p.mode, p.warn, p.created_at, p.expires_at, u.name, u.tag,
    (SELECT count(*)::int FROM care c WHERE c.post_id = p.id) AS cares,
    (SELECT count(*)::int FROM replies r WHERE r.post_id = p.id AND NOT r.hidden) AS reply_count,
    EXISTS (SELECT 1 FROM care c WHERE c.post_id = p.id AND c.user_id = $1::bigint) AS cared
  FROM posts p
  JOIN users u ON u.id = p.user_id
  WHERE p.expires_at > now() AND NOT p.hidden`;

const mapPost = (row, uid) => ({
  id: row.id,
  name: display(row.name, row.tag),
  text: row.content,
  mode: row.mode,
  warn: row.warn,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  cares: row.cares,
  replyCount: row.reply_count,
  cared: row.cared,
  mine: uid != null && row.user_id === uid
});

router.get("/posts", async (req, res) => {
  const uid = req.user?.id ?? null;
  const { rows } = await q(`${POST_SQL} ORDER BY p.created_at DESC LIMIT 60`, [uid]);
  res.json({ posts: rows.map((r) => mapPost(r, uid)) });
});

router.get("/posts/:id", async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: "invalid_id" });
  const uid = req.user?.id ?? null;
  const { rows } = await q(`${POST_SQL} AND p.id = $2::bigint`, [uid, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: "not_found" });

  const post = rows[0];
  const rep = await q(
    `SELECT r.id, r.user_id, r.content, r.warn, r.created_at, r.to_reply_id, u.name, u.tag,
            tu.name AS to_name, tu.tag AS to_tag
     FROM replies r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN replies tr ON tr.id = r.to_reply_id
     LEFT JOIN users tu ON tu.id = tr.user_id
     WHERE r.post_id = $1 AND NOT r.hidden
     ORDER BY r.created_at ASC LIMIT 300`,
    [req.params.id]
  );
  res.json({
    post: mapPost(post, uid),
    replies: rep.rows.map((r) => ({
      id: r.id,
      name: display(r.name, r.tag),
      text: r.content,
      warn: r.warn,
      owner: r.user_id === post.user_id, // ใช้แสดงป้าย "เจ้าของโพส"
      toId: r.to_reply_id,
      toName: r.to_name ? display(r.to_name, r.to_tag) : null,
      createdAt: r.created_at,
      mine: uid != null && r.user_id === uid
    }))
  });
});

router.post("/posts", requireUser, async (req, res) => {
  const text = cleanText(req.body?.text, 1000);
  const days = Number(req.body?.days);
  const mode = req.body?.mode;
  if (!text) return res.status(400).json({ error: "invalid_text", message: "พิมพ์ข้อความ 1-1000 ตัวอักษร" });
  if (!DAYS.includes(days)) return res.status(400).json({ error: "invalid_days" });
  if (!MODES.includes(mode)) return res.status(400).json({ error: "invalid_mode" });

  const { rows: cnt } = await q(
    "SELECT count(*)::int AS n FROM posts WHERE user_id = $1 AND created_at > now() - interval '24 hours'",
    [req.user.id]
  );
  if (cnt[0].n >= MAX_POSTS_PER_DAY) {
    return res.status(429).json({ error: "too_many_posts", message: "วันนี้โพสครบจำนวนแล้ว พรุ่งนี้มาใหม่ได้นะ" });
  }

  const verdict = await guard(res, text);
  if (!verdict) return;

  const { rows } = await q(
    `INSERT INTO posts (user_id, content, mode, warn, expires_at)
     VALUES ($1, $2, $3, $4, now() + make_interval(days => $5))
     RETURNING id`,
    [req.user.id, text, mode, verdict.warn, days]
  );
  // support = true -> ให้หน้าเว็บแสดงข้อความอ่อนโยนพร้อมข้อมูลช่วยเหลือ (โพสยังผ่านตามปกติ)
  res.status(201).json({ id: rows[0].id, support: verdict.support });
});

router.delete("/posts/:id", requireUser, async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: "invalid_id" });
  const r = await q("DELETE FROM posts WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  res.status(r.rowCount ? 204 : 404).end();
});

// ---------- replies ----------
router.post("/posts/:id/replies", requireUser, async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: "invalid_id" });
  const uid = req.user.id;

  const { rows: found } = await q(
    "SELECT id, user_id, mode FROM posts WHERE id = $1 AND expires_at > now() AND NOT hidden",
    [req.params.id]
  );
  const post = found[0];
  if (!post) return res.status(404).json({ error: "not_found" });
  const isOwner = post.user_id === uid;

  const { rows: hour } = await q(
    "SELECT count(*)::int AS n FROM replies WHERE user_id = $1 AND created_at > now() - interval '1 hour'",
    [uid]
  );
  if (hour[0].n >= MAX_REPLIES_PER_HOUR) {
    return res.status(429).json({ error: "too_many_replies", message: "ตอบเยอะแล้วในชั่วโมงนี้ พักสักครู่นะ" });
  }
  if (!isOwner) {
    const { rows: per } = await q("SELECT count(*)::int AS n FROM replies WHERE post_id = $1 AND user_id = $2", [post.id, uid]);
    if (per[0].n >= MAX_REPLIES_PER_POST) {
      return res.status(429).json({ error: "too_many_replies_on_post", message: "ตอบโพสนี้ครบจำนวนแล้ว" });
    }
  }

  let content;
  let warn = false;
  const preset = req.body?.preset;
  if (preset !== undefined) {
    // ข้อความสำเร็จรูป: ใครก็ส่งได้ ไม่ต้องตรวจ
    if (!Number.isInteger(preset) || preset < 0 || preset >= PRESETS.length) {
      return res.status(400).json({ error: "invalid_preset" });
    }
    content = PRESETS[preset];
  } else {
    // โหมดรับแค่ห่วงใย/ข้อความสั้นๆ: เฉพาะเจ้าของโพสที่พิมพ์เองได้
    if (post.mode === "reactions" && !isOwner) {
      return res.status(403).json({ error: "reactions_only", message: "เจ้าของโพสเลือกรับเฉพาะข้อความสั้นๆ" });
    }
    content = cleanText(req.body?.text, 500);
    if (!content) return res.status(400).json({ error: "invalid_text", message: "พิมพ์ข้อความ 1-500 ตัวอักษร" });
    const verdict = await guard(res, content);
    if (!verdict) return;
    warn = verdict.warn;
  }

  // เจ้าของโพสตอบกลับข้อความของคนอื่นได้
  let toReplyId = null;
  if (req.body?.toReplyId !== undefined) {
    if (!isOwner || !isId(String(req.body.toReplyId))) return res.status(400).json({ error: "invalid_target" });
    const t = await q("SELECT 1 FROM replies WHERE id = $1 AND post_id = $2 AND NOT hidden", [String(req.body.toReplyId), post.id]);
    if (!t.rowCount) return res.status(400).json({ error: "invalid_target" });
    toReplyId = String(req.body.toReplyId);
  }

  const { rows } = await q(
    "INSERT INTO replies (post_id, user_id, content, to_reply_id, warn) VALUES ($1, $2, $3, $4, $5) RETURNING id",
    [post.id, uid, content, toReplyId, warn]
  );
  res.status(201).json({ id: rows[0].id });
});

router.delete("/replies/:id", requireUser, async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: "invalid_id" });
  const r = await q("DELETE FROM replies WHERE id = $1 AND user_id = $2", [req.params.id, req.user.id]);
  res.status(r.rowCount ? 204 : 404).end();
});

// ---------- care ----------
router.post("/posts/:id/care", requireUser, async (req, res) => {
  if (!isId(req.params.id)) return res.status(400).json({ error: "invalid_id" });
  const id = req.params.id;
  const uid = req.user.id;

  const del = await q("DELETE FROM care WHERE post_id = $1 AND user_id = $2", [id, uid]);
  let cared = false;
  if (del.rowCount === 0) {
    const ins = await q(
      `INSERT INTO care (post_id, user_id)
       SELECT p.id, $2::bigint FROM posts p WHERE p.id = $1 AND p.expires_at > now() AND NOT p.hidden
       ON CONFLICT DO NOTHING`,
      [id, uid]
    );
    if (ins.rowCount === 0) return res.status(404).json({ error: "not_found" });
    cared = true;
  }
  const { rows } = await q("SELECT count(*)::int AS n FROM care WHERE post_id = $1", [id]);
  res.json({ cared, cares: rows[0].n });
});

// ---------- reports ----------
// ถูกรายงานจากคนละบัญชีครบ REPORT_HIDE_AT ครั้ง จะซ่อนอัตโนมัติ (ยังไม่มีหน้าแอดมิน)
router.post("/reports", requireUser, async (req, res) => {
  const { postId, replyId } = req.body || {};
  if (isId(postId) === isId(replyId)) {
    return res.status(400).json({ error: "specify_post_or_reply" });
  }
  const reason = typeof req.body.reason === "string" ? req.body.reason.slice(0, 200) : null;
  const uid = req.user.id;

  // 1) บัญชีใหม่ยังรายงานไม่ได้ (กันสร้างหลายบัญชีมารายงานซ่อนโพสของคนอื่น)
  const { rows: me } = await q(
    "SELECT created_at > now() - make_interval(hours => $2) AS too_new FROM users WHERE id = $1",
    [uid, REPORT_MIN_ACCOUNT_HOURS]
  );
  if (me[0]?.too_new) {
    return res.status(403).json({
      error: "account_too_new",
      message: "บัญชีใหม่ยังรายงานไม่ได้ ลองใหม่ในวันถัดไปนะ (เพื่อกันการรายงานกลั่นแกล้ง) ถ้าเจอเรื่องเร่งด่วนโปรดติดต่อผู้ดูแล"
    });
  }

  // 2) จำกัดจำนวนรายงานต่อวัน
  const { rows: today } = await q(
    "SELECT count(*)::int AS n FROM reports WHERE reporter_id = $1 AND created_at > now() - interval '24 hours'",
    [uid]
  );
  if (today[0].n >= REPORT_MAX_PER_DAY) {
    return res.status(429).json({ error: "too_many_reports", message: "วันนี้รายงานครบจำนวนแล้ว พรุ่งนี้ลองใหม่ได้นะ" });
  }

  // 3) รายงานของตัวเองไม่ได้ และต้องมีเนื้อหานั้นอยู่จริง
  const target = isId(postId)
    ? await q("SELECT user_id FROM posts WHERE id = $1", [postId])
    : await q("SELECT user_id FROM replies WHERE id = $1", [replyId]);
  if (!target.rowCount) return res.status(404).json({ error: "not_found" });
  if (String(target.rows[0].user_id) === String(uid)) {
    return res.status(400).json({ error: "own_content", message: "รายงานข้อความของตัวเองไม่ได้ ลบทิ้งได้เลยนะ" });
  }

  try {
    await q(
      "INSERT INTO reports (reporter_id, post_id, reply_id, reason) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
      [uid, isId(postId) ? postId : null, isId(replyId) ? replyId : null, reason]
    );
  } catch (e) {
    if (e.code === "23503") return res.status(404).json({ error: "not_found" });
    throw e;
  }
  // ซ่อนอัตโนมัติเมื่อครบเกณฑ์ ยกเว้นที่แอดมินอนุมัติแล้ว (reviewed)
  // เติม AND NOT hidden เพื่อให้ RETURNING คืนแถวเฉพาะครั้งที่ "เพิ่งถูกซ่อน" จะได้แจ้งแอดมินครั้งเดียว
  const isPost = isId(postId);
  const { rows: hid } = await q(
    isPost
      ? "UPDATE posts SET hidden = true WHERE id = $1 AND NOT reviewed AND NOT hidden AND (SELECT count(*) FROM reports WHERE post_id = $1) >= $2 RETURNING id"
      : "UPDATE replies SET hidden = true WHERE id = $1 AND NOT reviewed AND NOT hidden AND (SELECT count(*) FROM reports WHERE reply_id = $1) >= $2 RETURNING id",
    [isPost ? postId : replyId, REPORT_HIDE_AT]
  );
  if (hid.length) notifyHidden(isPost ? "post" : "reply", hid[0].id, REPORT_HIDE_AT); // ไม่ await ไม่ให้ผู้ใช้รอ
  res.status(202).json({ ok: true });
});