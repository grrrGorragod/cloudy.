import { useEffect, useState } from "react";
import { Deco } from "./Cloud.jsx";
import { CREATOR } from "./config.js";

// หน้าแนะนำวิธีใช้ ขึ้นครั้งแรกก่อนตั้งชื่อ (overlay = เปิดซ้ำจากหน้า "เกี่ยวกับเรา")
// ข้อความทุกข้อต้องตรงกับที่ backend ทำจริง (ดู vent-backend/README.md หัวข้อ ความเป็นส่วนตัว / moderation)
function steps(helpline) {
  return [
    {
      t: "ยินดีต้อนรับสู่ cloudy.",
      p: "ที่นี่คือท้องฟ้าที่ทุกความรู้สึกลอยได้ เขียนสิ่งที่อยู่ในใจเป็นก้อนเมฆ แล้วปล่อยให้มันลอยไป ไม่ต้องสมัครด้วยอีเมลหรือเบอร์โทร และไม่ต้องเข้มแข็งก่อนถึงจะเขียนได้"
    },
    {
      t: "ไม่มีใครรู้ว่าคุณเป็นใคร",
      li: [
        "ตั้งชื่ออะไรก็ได้ ระบบจะเติมรหัสท้ายชื่อให้ เช่น ดาว#4821",
        "เราไม่เก็บ IP ของคุณ และไม่บันทึกเนื้อหาข้อความลงล็อก",
        "ไม่มีรหัสผ่าน แต่จะมี “กุญแจ” ไว้กลับมาใช้ชื่อเดิมเมื่อเปลี่ยนเครื่อง จดเก็บไว้ให้ดี เพราะหายแล้วกู้คืนไม่ได้"
      ]
    },
    {
      t: "ปล่อยเมฆ และฟังกัน",
      li: [
        "เล่าได้ตามสบาย เลือกได้ว่าอยากให้เมฆอยู่กี่วัน พอครบกำหนด เมฆและคำตอบทั้งหมดจะถูกลบถาวร",
        "ถ้ายังไม่พร้อมอ่านคำพูดของใคร เลือกรับแค่ “ห่วงใย” กับข้อความสั้นๆ ได้",
        "เจอเมฆของคนอื่น กด ♡ ห่วงใยเพื่อบอกว่ารับรู้ หรือพิมพ์ตอบสั้นๆ ฟังก่อนก็พอ ไม่ต้องแก้ปัญหาให้เขา"
      ]
    },
    {
      t: "ช่วยกันดูแลพื้นที่นี้",
      li: [
        "ทุกข้อความถูกตรวจด้วย AI (OpenAI) ก่อนโพส เพื่อกันการด่าทอและการทำร้ายกัน และกันไม่ให้เผลอใส่เบอร์โทร อีเมล หรือไอดีโซเชียลของตัวเอง",
        "เรื่องหนักของตัวเองเล่าได้ แต่ไม่รับการโจมตีผู้อื่น เนื้อหาอ่อนไหวจะมีคำเตือนให้เลือกกดอ่านเมื่อพร้อม",
        "เจอข้อความที่ไม่เหมาะสม กด “รายงาน” ผู้ดูแลจะตรวจสอบ"
      ]
    },
    {
      t: "ถึงคุณที่เพิ่งมาถึง",
      p: `สวัสดีครับ ผม${CREATOR.name} ผู้สร้างที่นี่ ผมไม่รู้ว่าตอนนี้คุณกำลังเจออะไรอยู่ แต่อยากให้รู้ว่าที่นี่เป็นพื้นที่ของคุณ ไม่ต้องอธิบายให้ใครฟัง และไม่ต้องรีบหายดี`,
      p2: helpline
        ? `ถ้าวันไหนหนักเกินจะแบกไว้คนเดียว โทร${helpline.name} ${helpline.number} ได้ตลอด 24 ชั่วโมง`
        : "ถ้าวันไหนหนักเกินจะแบกไว้คนเดียว ติดต่อคนที่ไว้ใจหรือสายด่วนสุขภาพจิตได้",
      p3: "คุณไม่ได้อยู่คนเดียวบนท้องฟ้านี้นะ ♡"
    }
  ];
}

export default function Intro({ onDone, helpline, overlay = false }) {
  const [i, setI] = useState(0);
  const list = steps(helpline);
  const s = list[i];
  const last = i === list.length - 1;

  useEffect(() => {
    if (!overlay) return;
    const f = (e) => e.key === "Escape" && onDone();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [overlay, onDone]);

  return (
    <>
      {overlay && <div className="scrim" onClick={onDone} />}
      <div className="welcome intro" role="dialog" aria-modal="true" aria-label="วิธีใช้เว็บ">
        <span className="me" aria-hidden="true"><Deco /></span>
        <h1>{s.t}</h1>
        {s.p && <p className="ip">{s.p}</p>}
        {s.li && <ul className="tips">{s.li.map((x) => <li key={x}>{x}</li>)}</ul>}
        {s.p2 && <p className="ip">{s.p2}</p>}
        {s.p3 && <p className="ip bold">{s.p3}</p>}
        <div className="dots" aria-label={`ขั้นที่ ${i + 1} จาก ${list.length}`}>
          {list.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}
        </div>
        <div className="row introbar">
          <span>
            {i > 0 && <button className="link" onClick={() => setI(i - 1)}>ย้อนกลับ</button>}
            {!last && <button className="link" style={{ marginLeft: i > 0 ? 14 : 0 }} onClick={onDone}>ข้าม</button>}
          </span>
          <button className="send" autoFocus onClick={() => (last ? onDone() : setI(i + 1))}>
            {last ? (overlay ? "ปิด" : "เริ่มเลย") : "ถัดไป"}
          </button>
        </div>
      </div>
    </>
  );
}
