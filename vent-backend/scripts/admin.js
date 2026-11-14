// เครื่องมือแอดมินแบบบรรทัดคำสั่ง รันในเครื่องคุณเอง ไม่เปิดเป็นหน้าเว็บ (ไม่มีช่องให้ใครโจมตีจากอินเทอร์เน็ต)
// ใช้:  npm run admin -- <คำสั่ง>      (ต้องมี DATABASE_URL ใน .env ชี้ไปฐานข้อมูลที่ต้องการดูแล)
import { pool, q } from "../src/db.js";

const HELP = `คำสั่ง
  reports                       รายการที่ถูกรายงาน/ซ่อนอยู่ (ใหม่สุดก่อน)
  show post|reply <id>          ดูเนื้อหาเต็ม พร้อมเหตุผลที่ถูกรายงาน
  hide post|reply <id>          ซ่อน
  approve post|reply <id>       อนุมัติ: เลิกซ่อน และไม่ซ่อนซ้ำจากรายงานเพิ่ม
  delete post|reply <id>        ลบถาวร
  delete-user <ชื่อ#รหัส> --yes   ลบบัญชีพร้อมโพสและคำตอบทั้งหมด (ใช้กับผู้ละเมิด หรือคำขอลบข้อมูล)`;

const [cmd, kind, id] = process.argv.slice(2);
const T = { post: "posts", reply: "replies" };
const clip = (t, n = 100) => (t.length > n ? t.slice(0, n) + "…" : t).replace(/\n/g, " ");
const ok = (r) => console.log(r.rowCount ? "เรียบร้อย" : "ไม่พบรายการนี้");

async function main() {
  switch (cmd) {
    case "reports": {
      for (const [k, table, col] of [["post", "posts", "post_id"], ["reply", "replies", "reply_id"]]) {
        const { rows } = await q(
          `SELECT t.id, t.content, t.hidden, t.reviewed, t.created_at, u.name, u.tag,
                  (SELECT count(*)::int FROM reports r WHERE r.${col} = t.id) AS n
           FROM ${table} t JOIN users u ON u.id = t.user_id
           WHERE EXISTS (SELECT 1 FROM reports r WHERE r.${col} = t.id)
           ORDER BY t.hidden DESC, n DESC, t.created_at DESC LIMIT 50`
        );
        console.log(`\n== ${k === "post" ? "โพส" : "คำตอบ"} ที่ถูกรายงาน (${rows.length}) ==`);
        for (const r of rows) {
          const st = r.hidden ? "ซ่อนอยู่" : r.reviewed ? "อนุมัติแล้ว" : "ยังแสดง";
          console.log(`#${r.id} [${st}] รายงาน ${r.n} ครั้ง  โดย ${r.name}#${r.tag}\n   ${clip(r.content)}`);
        }
      }
      break;
    }
    case "show": {
      if (!T[kind] || !/^\d+$/.test(id || "")) return console.log(HELP);
      const col = kind === "post" ? "post_id" : "reply_id";
      const { rows } = await q(
        `SELECT t.content, t.hidden, t.reviewed, t.created_at, u.name, u.tag FROM ${T[kind]} t JOIN users u ON u.id = t.user_id WHERE t.id = $1`, [id]);
      if (!rows[0]) return console.log("ไม่พบรายการนี้");
      const r = rows[0];
      console.log(`โดย ${r.name}#${r.tag}  เมื่อ ${r.created_at.toISOString()}  hidden=${r.hidden} reviewed=${r.reviewed}\n\n${r.content}\n`);
      const rep = await q(`SELECT reason, created_at FROM reports WHERE ${col} = $1 ORDER BY created_at`, [id]);
      console.log(`เหตุผลที่ถูกรายงาน (${rep.rowCount})`);
      rep.rows.forEach((x) => console.log(`- ${x.created_at.toISOString()}  ${x.reason || "(ไม่ระบุ)"}`));
      break;
    }
    case "hide":
    case "approve":
    case "delete": {
      if (!T[kind] || !/^\d+$/.test(id || "")) return console.log(HELP);
      const sql = {
        hide: `UPDATE ${T[kind]} SET hidden = true WHERE id = $1`,
        approve: `UPDATE ${T[kind]} SET hidden = false, reviewed = true WHERE id = $1`,
        delete: `DELETE FROM ${T[kind]} WHERE id = $1`
      }[cmd];
      ok(await q(sql, [id]));
      break;
    }
    case "delete-user": {
      const m = /^(.+)#(\d{4})$/.exec(kind || "");
      if (!m) return console.log(HELP);
      if (!process.argv.includes("--yes")) return console.log("คำสั่งนี้ลบถาวร ถ้าแน่ใจให้เติม --yes ท้ายคำสั่ง");
      ok(await q("DELETE FROM users WHERE lower(name) = lower($1) AND tag = $2", [m[1], m[2]]));
      break;
    }
    default:
      console.log(HELP);
  }
}

try { await main(); }
catch (e) { console.error("ผิดพลาด:", e.message); process.exitCode = 1; }
finally { await pool.end(); }
