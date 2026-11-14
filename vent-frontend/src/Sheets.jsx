import { useCallback, useEffect, useState } from "react";
import { api, msg } from "./api.js";
import { getKey, setKey, normalizeKey } from "./key.js";
import { remaining } from "./Sky.jsx";
import { CREATOR } from "./config.js";
import QR_SRC from "./Qr.js";
import { Deco } from "./Cloud.jsx";

// คัดลอกลงคลิปบอร์ด คืน true ถ้าสำเร็จ (writeText เป็น async จึงต้อง await ถึงจะจับ error ได้)
export async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
}

export function Sheet({ onClose, title, children }) {
  useEffect(() => {
    const f = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
  return (
    <div className="ov" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <button className="close" onClick={onClose} aria-label="ปิด">×</button>
        {children}
      </div>
    </div>
  );
}

export function PostSheet({ id, cfg, onClose, onChanged, onSeen }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [gate, setGate] = useState(true);
  const [text, setText] = useState("");
  const [to, setTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(() => new Set()); // id คำตอบที่กดอ่านแล้ว

  const load = useCallback(
    () => api.post(id).then(setData).catch((e) => setErr(e.status === 404 ? "โพสนี้หมดอายุหรือถูกลบแล้ว" : msg(e))),
    [id]
  );
  useEffect(() => { load(); }, [load]);

  // เปิดโพสของตัวเอง = อ่านคำตอบและห่วงใยทั้งหมดแล้ว (นับเฉพาะคำตอบจากคนอื่น ให้ตรงกับที่เซิร์ฟเวอร์นับ)
  useEffect(() => {
    if (data?.post?.mine) onSeen?.(data.post.id, data.replies.filter((r) => !r.owner).length, data.post.cares);
  }, [data, onSeen]);

  const post = data?.post;
  if (!post) {
    return <Sheet onClose={onClose} title="โพส"><p className="note">{err || "กำลังโหลด..."}</p></Sheet>;
  }
  if (post.warn && gate) {
    return (
      <Sheet onClose={onClose} title="เนื้อหาอ่อนไหว">
        <h2>เนื้อหาอ่อนไหว</h2>
        <p className="note">โพสนี้อาจพูดถึงเรื่องที่กระทบจิตใจ อ่านต่อเมื่อพร้อมนะ</p>
        <div className="row">
          <button className="send" onClick={() => setGate(false)}>อ่านต่อ</button>
          <button className="chip" onClick={onClose}>ปิด</button>
        </div>
      </Sheet>
    );
  }

  const canType = post.mode === "free" || post.mine;
  const rem = remaining(post);

  async function run(fn) {
    setBusy(true);
    setErr("");
    try { await fn(); } catch (e) { setErr(msg(e)); } finally { setBusy(false); }
  }
  const send = (payload) =>
    run(async () => {
      await api.reply(id, payload);
      setText("");
      setTo(null);
      await load();
      onChanged();
    });
  const toggleCare = () =>
    run(async () => {
      const r = await api.care(id);
      setData((d) => ({ ...d, post: { ...d.post, cared: r.cared, cares: r.cares } }));
      onChanged();
    });
  const report = (body) => {
    if (!window.confirm("แจ้งว่าข้อความนี้ไม่เหมาะสม?")) return;
    run(async () => { await api.report(body); setNote("ขอบคุณที่แจ้ง เราจะตรวจสอบ"); });
  };
  const removeReply = (rid) => {
    if (!window.confirm("ลบข้อความนี้ถาวร?")) return;
    run(async () => { await api.deleteReply(rid); await load(); onChanged(); });
  };
  const remove = () => {
    if (!window.confirm("ลบโพสนี้ถาวร? คำตอบทั้งหมดจะหายไปด้วย")) return;
    run(async () => { await api.deletePost(id); onChanged(); onClose(); });
  };

  return (
    <Sheet onClose={onClose} title={`โพสของ ${post.name}`}>
      <h2>{post.name}<span className="badge">เจ้าของโพส</span></h2>
      <div className="body">{post.text}</div>
      <div className="meta">{rem.label}</div>
      <div className="row">
        <button className="care" aria-pressed={post.cared} disabled={busy} onClick={toggleCare}>
          {post.cared ? "♥" : "♡"} ห่วงใย {post.cares}
        </button>
        {post.mine
          ? <button className="link" onClick={remove}>ลบโพสนี้</button>
          : <button className="link" onClick={() => report({ postId: post.id })}>รายงาน</button>}
      </div>

      {data.replies.map((r) => {
        // คำตอบที่ติดป้ายเนื้อหาอ่อนไหว ซ่อนไว้จนกว่าจะกดอ่าน (ของตัวเองแสดงตามปกติ)
        const gated = r.warn && !r.mine && !shown.has(r.id);
        return (
          <div className={"reply" + (r.owner ? " owner" : "")} key={r.id}>
            <b>{r.name}</b>
            {r.owner && <span className="badge">เจ้าของโพส</span>}
            {r.toName && <span className="to">  ↳ ตอบ {r.toName}</span>}
            {gated ? (
              <p className="note">
                ข้อความนี้อาจพูดถึงเรื่องที่กระทบจิตใจ{"  "}
                <button className="link" onClick={() => setShown((s) => new Set(s).add(r.id))}>แตะเพื่ออ่าน</button>
              </p>
            ) : (
              <p>{r.text}</p>
            )}
            {post.mine && !r.owner && !gated && <button className="link" onClick={() => setTo(r)}>ตอบกลับ</button>}
            {!r.mine && !(post.mine && r.owner) && (
              <button className="link" style={{ marginLeft: 12 }} onClick={() => report({ replyId: r.id })}>รายงาน</button>
            )}
            {r.mine && <button className="link" disabled={busy} onClick={() => removeReply(r.id)}>ลบ</button>}
          </div>
        );
      })}

      <div style={{ marginTop: 14 }}>
        {canType ? (
          <>
            {to && (
              <p className="note">
                กำลังตอบ {to.name}  <button className="link" onClick={() => setTo(null)}>ยกเลิก</button>
              </p>
            )}
            <label htmlFor="rt">ข้อความ</label>
            <textarea
              id="rt"
              value={text}
              maxLength={500}
              onChange={(e) => setText(e.target.value)}
              placeholder="ฟังก่อนก็พอ ไม่ต้องแก้ปัญหาให้เขา"
            />
            <div className="row">
              <button
                className="send"
                disabled={busy || !text.trim()}
                onClick={() => send({ text: text.trim(), ...(to ? { toReplyId: to.id } : {}) })}
              >
                ส่งคำตอบ
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="note">เจ้าของโพสเลือกรับเฉพาะข้อความสั้นๆ เลือกอันที่ตรงใจได้เลย</p>
            <div className="row">
              {(cfg?.presets || []).map((t, i) => (
                <button key={t} className="chip" disabled={busy} onClick={() => send({ preset: i })}>{t}</button>
              ))}
            </div>
          </>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        {note && <p className="note" role="status">{note}</p>}
      </div>
    </Sheet>
  );
}

// draft/setDraft อยู่ที่ App เพื่อให้ข้อความไม่หายถ้าเผลอปิดหน้าต่าง (เก็บในหน่วยความจำเท่านั้น ไม่เขียนลงเครื่อง)
export function ComposeSheet({ me, cfg, draft, setDraft, onClose, onSubmit }) {
  const { text, days, mode } = draft;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    try { await onSubmit({ text: text.trim(), days, mode }); }
    catch (e) { setErr(msg(e)); setBusy(false); }
  }

  return (
    <Sheet onClose={onClose} title="ระบายความรู้สึก">
      <h2>ระบายความรู้สึก</h2>
      <p className="note">โพสในชื่อ {me}</p>
      <label htmlFor="tx">อยากเล่าอะไร</label>
      <textarea id="tx" value={text} maxLength={1000} onChange={(e) => set({ text: e.target.value })} placeholder="พิมพ์ได้เลย ที่นี่ไม่มีใครรู้ว่าคุณเป็นใคร" />
      <label>ให้โพสอยู่กี่วัน</label>
      <div className="seg">
        {(cfg?.durations || [1, 3, 7, 14]).map((d) => (
          <button key={d} aria-pressed={days === d} onClick={() => set({ days: d })}>{d} วัน</button>
        ))}
      </div>
      <label>การตอบกลับ</label>
      <div className="seg">
        <button aria-pressed={mode === "free"} onClick={() => set({ mode: "free" })}>รับคำตอบที่พิมพ์เอง</button>
        <button aria-pressed={mode === "reactions"} onClick={() => set({ mode: "reactions" })}>รับแค่ห่วงใยและข้อความสั้นๆ</button>
      </div>
      <p className="note">ครบกำหนดแล้วโพสและคำตอบจะถูกลบถาวร</p>
      <p className="note">ถ้าเผลอปิดหน้านี้ ข้อความที่พิมพ์ไว้จะยังอยู่ จนกว่าจะปล่อยเมฆหรือรีเฟรชหน้า</p>
      <p className="note">ข้อความจะถูกตรวจเนื้อหาด้วย AI (OpenAI) ก่อนโพสทุกครั้ง</p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="send" disabled={busy || !text.trim()} onClick={submit}>
          {busy ? "กำลังตรวจข้อความ..." : "ปล่อยเมฆขึ้นฟ้า"}
        </button>
      </div>
    </Sheet>
  );
}

export function DonateSheet({ onClose, onIntro }) {
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const n = CREATOR.account;
  const shown = `${n.slice(0, 3)}-${n.slice(3, 4)}-${n.slice(4, 9)}-${n.slice(9)}`; // รูปแบบเลขบัญชี 3-1-5-1
  const copy = async () => {
    if (await copyText(n)) setCopied(true); else setErr("คัดลอกไม่ได้ ลองจดเลขด้วยมือแทนนะ");
  };
  return (
    <Sheet onClose={onClose} title="สนับสนุน">
      <h2>เกี่ยวกับที่นี่</h2>
      <div className="about">
        <span className="me" aria-hidden="true"><Deco /></span>
        <p>
        สวัสดีครับ ผม{CREATOR.name} ผู้สร้างที่นี่ ผมไม่รู้ว่าตอนนี้คุณกำลังเจออะไรอยู่
        แต่ในวันที่ผมเจอเรื่องแย่ๆ และอึดอัดใจ ผมต้องการแค่ใครสักคนที่รับฟัง หรือแค่มีพื้นที่ไว้ระบาย
        ที่นี่เลยเกิดขึ้น
      </p>
      </div>
      <div className="row"><button className="chip" onClick={onIntro}>ดูวิธีใช้เว็บอีกครั้ง</button></div>
      <p className="note">
        ที่นี่ไม่ต้องสมัครด้วยอีเมลหรือเบอร์โทร และไม่เก็บ IP ของคุณ
        ข้อความทุกข้อความถูกตรวจเนื้อหาด้วย AI (OpenAI) ก่อนโพส เพื่อกันการด่าทอและการทำร้ายกัน
        เราส่งไปเฉพาะตัวข้อความ ไม่ส่งกุญแจหรือ IP ของคุณ และตามเอกสารของ OpenAI
        ข้อความที่ส่งตรวจจะไม่ถูกนำไปฝึกโมเดลและไม่ถูกเก็บไว้ที่ฝั่งบริการตรวจเนื้อหา
      </p>
      <h2 style={{ marginTop: 18 }}>สนับสนุนค่าเซิร์ฟเวอร์</h2>
      <p className="note">ถ้าอยากช่วยค่าเซิร์ฟเวอร์และการดูแลระบบ โอนเข้าบัญชี{CREATOR.bank} (ชื่อบัญชี {CREATOR.name}) หรือสแกน QR ด้านล่างได้ ไม่โอนก็ไม่เป็นไรเลย ใช้ได้เหมือนเดิม</p>
      <div className="keybox" style={{ textAlign: "center", fontSize: 20 }}>{shown}</div>
      <p className="note" style={{ textAlign: "center" }}>{CREATOR.bank}</p>
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="chip" onClick={copy}>{copied ? "คัดลอกแล้ว" : "คัดลอกเลขบัญชี"}</button>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <p className="note" style={{ textAlign: "center" }}>หรือสแกน QR ด้วยแอปธนาคาร</p>
      <div className="qrwrap">
        <img className="qr" src={QR_SRC} alt="QR สำหรับสนับสนุนค่าเซิร์ฟเวอร์" width="220" height="220" />
      </div>
      <div className="row" style={{ justifyContent: "center" }}>
        <a className="chip" href={QR_SRC} download="cloudy-donate-qr.png">บันทึกรูป QR</a>
        <a className="chip gh" href={CREATOR.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub ของผู้สร้าง" title="GitHub ของผู้สร้าง">
          <svg viewBox="0 0 16 16" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
        </a>
      </div>
    </Sheet>
  );
}

export function KeySheet({ onClose, onSwitched }) {
  const [copied, setCopied] = useState(false);
  const [other, setOther] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const key = getKey() || "";

  const copy = async () => {
    if (await copyText(key)) setCopied(true); else setErr("คัดลอกไม่ได้ ลองจดด้วยมือแทนนะ");
  };
  async function useOther() {
    const k = normalizeKey(other);
    if (!window.confirm("กุญแจปัจจุบันของเครื่องนี้จะถูกแทนที่ ถ้ายังไม่ได้จดไว้จะกู้คืนไม่ได้ ต้องการดำเนินการต่อ?")) return;
    setBusy(true);
    setErr("");
    try {
      const r = await api.me(k);
      setKey(k);
      onSwitched(r.name);
    } catch (e) {
      setErr(e.status === 401 ? "ไม่พบกุญแจนี้ ลองตรวจตัวอักษรอีกครั้ง" : msg(e));
      setBusy(false);
    }
  }

  return (
    <Sheet onClose={onClose} title="กุญแจของฉัน">
      <h2>กุญแจของฉัน</h2>
      <p className="note">กุญแจนี้ใช้ดูคำตอบของโพสคุณและย้ายไปเครื่องอื่น ใครมีกุญแจก็เป็นเจ้าของตัวตนนี้ได้ จดเก็บไว้ที่ปลอดภัย ถ้าหายจะกู้คืนไม่ได้</p>
      <div className="keybox">{key}</div>
      <div className="row"><button className="chip" onClick={copy}>{copied ? "คัดลอกแล้ว" : "คัดลอกกุญแจ"}</button></div>
      <label htmlFor="mk">ย้ายมาจากเครื่องอื่น ใส่กุญแจเดิมที่นี่</label>
      <input id="mk" type="text" value={other} onChange={(e) => setOther(e.target.value)} autoComplete="off" spellCheck="false" />
      <div className="row">
        <button className="send" disabled={busy || other.trim().length < 20} onClick={useOther}>ใช้กุญแจนี้</button>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
    </Sheet>
  );
}