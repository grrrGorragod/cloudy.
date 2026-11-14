// ใส่โพสจำลองหลายๆ อันเพื่อทดสอบหน้าตาของโคมบนท้องฟ้า
//   npm run seed -- 40            ใส่โพสจำลอง 40 อัน (พร้อมคำตอบและห่วงใยสุ่ม)
//   npm run seed -- clean         ลบข้อมูลจำลองทั้งหมดที่สคริปต์นี้เคยใส่
// ถ้า DATABASE_URL ไม่ใช่เครื่องตัวเอง (เช่น Neon) ต้องเติม --yes เพราะจะเขียนลงฐานข้อมูลนั้นจริง
// ข้อมูลจำลองใช้บัญชีที่ key_hash ขึ้นต้นด้วย "seed-" จึงลบออกได้หมดโดยไม่กระทบข้อมูลจริง
import { randomUUID } from "node:crypto";
import { pool, q } from "../src/db.js";

const arg = process.argv[2];
const yes = process.argv.includes("--yes");
const DAYS = [1, 3, 7, 14];
const NAMES = ["นกน้อย", "ดาวเหนือ", "เมฆขาว", "ใบไม้", "คลื่นเล็ก", "หิ่งห้อย", "ลมเย็น", "จันทร์เสี้ยว", "ฝนปรอย", "แมวเหมียว"];

const TEXTS = [
  "วันนี้เหนื่อยมากเลย ทำงานทั้งวันแต่ไม่มีใครเห็นค่า",
  "แฟนเลิกกับเรามาสามเดือนแล้ว ยังทำใจไม่ได้",
  "สอบตกอีกแล้ว รู้สึกว่าตัวเองไม่เก่งพอ",
  "เหงามาก อยู่คนเดียวในห้องทุกวัน",
  "คิดถึงยายมาก ยายเพิ่งเสียไปเมื่อเดือนก่อน",
  "หัวหน้าเห็นแก่ตัวมาก เกลียดเลย ทำงานด้วยแล้วเครียดทุกวัน",
  "แม่ชอบเปรียบเทียบเรากับลูกคนอื่น เสียใจมากเลย ไม่รู้จะบอกใครดี",
  "สั้นๆ",
  "ขอบคุณทุกคนที่ส่งกำลังใจมาให้นะ ดีขึ้นเยอะเลย",
  "เพื่อนสนิทหายไปเฉยๆ ไม่ตอบไลน์เลย เราทำอะไรผิดหรือเปล่า",
  "ทำงานหนักมากแต่เงินเดือนไม่ขึ้น เหนื่อยใจ " + "เล่ายาวๆ เพื่อดูว่าข้อความที่ยาวมากจะถูกตัดบรรทัดสวยไหม ".repeat(8),
  "วันนี้ร้องไห้ในห้องน้ำที่ทำงาน ไม่มีใครรู้"
];
const REPLIES = ["กอดๆ นะ", "เราก็เป็นเหมือนกัน ไม่ได้อยู่คนเดียว", "สู้ๆ นะ พรุ่งนี้อาจดีขึ้น", "ขอบคุณที่เล่าให้ฟัง", "ส่งกำลังใจให้ค่ะ"];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const sample = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n);

async function clean() {
  const r = await q("DELETE FROM users WHERE key_hash LIKE 'seed-%'");
  console.log(`ลบบัญชีจำลอง ${r.rowCount} บัญชี (โพส คำตอบ ห่วงใย ถูกลบตามอัตโนมัติ)`);
}

async function seed(n) {
  const M = Math.max(6, Math.ceil(n / 3));
  const ids = [];
  for (let i = 0; i < M; i++) {
    const { rows } = await q(
      "INSERT INTO users (key_hash, name, tag) VALUES ($1, $2, $3) RETURNING id",
      [`seed-${randomUUID()}`, NAMES[i % NAMES.length], String(i + 1).padStart(4, "0")]
    );
    ids.push(rows[0].id);
  }
  for (let i = 0; i < n; i++) {
    const author = pick(ids);
    const total = pick(DAYS);
    const leftSecs = Math.round(total * 86400 * (0.05 + Math.random() * 0.95)); // เหลือเวลาสุ่ม จะได้เห็นทั้งโคมใหม่และโคมใกล้หมดอายุ
    const { rows } = await q(
      `INSERT INTO posts (user_id, content, mode, warn, expires_at, created_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5), now() + make_interval(secs => $5) - make_interval(days => $6))
       RETURNING id`,
      [author, pick(TEXTS), Math.random() < 0.5 ? "free" : "reactions", Math.random() < 0.15, leftSecs, total]
    );
    const pid = rows[0].id;
    const others = ids.filter((u) => u !== author);
    const cares = sample(others, Math.floor(Math.random() * Math.min(10, others.length)));
    if (cares.length) await q("INSERT INTO care (post_id, user_id) SELECT $1, unnest($2::bigint[])", [pid, cares]);
    const rc = Math.floor(Math.random() * 4);
    if (rc) {
      const who = Array.from({ length: rc }, () => pick(others));
      await q("INSERT INTO replies (post_id, user_id, content) SELECT $1, unnest($2::bigint[]), unnest($3::text[])", [pid, who, who.map(() => pick(REPLIES))]);
    }
  }
  console.log(`ใส่โพสจำลอง ${n} อัน จากบัญชีจำลอง ${M} บัญชี เปิดเว็บดูได้เลย (หน้าแรกแสดงโพสล่าสุด 60 อัน)`);
}

try {
  const host = new URL(process.env.DATABASE_URL).hostname;
  const local = ["localhost", "127.0.0.1", "::1"].includes(host);
  console.log("ฐานข้อมูล:", host);
  if (arg === "clean") {
    if (!local && !yes) console.log("ฐานข้อมูลนี้ไม่ใช่เครื่องตัวเอง ถ้าแน่ใจให้เติม --yes ท้ายคำสั่ง");
    else await clean();
  } else if (/^\d+$/.test(arg || "")) {
    if (!local && !yes) console.log("ฐานข้อมูลนี้ไม่ใช่เครื่องตัวเอง (ถ้าเป็นฐานข้อมูลจริงที่มีผู้ใช้ ควรใช้ branch ทดสอบแทน) ถ้าแน่ใจให้เติม --yes ท้ายคำสั่ง");
    else await seed(Math.min(200, Math.max(1, Number(arg))));
  } else {
    console.log("ใช้:  npm run seed -- 40   หรือ   npm run seed -- clean");
  }
} catch (e) { console.error("ผิดพลาด:", e.message); process.exitCode = 1; }
finally { await pool.end(); }