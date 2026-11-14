import { useCallback, useEffect, useState } from "react";
import { api, msg } from "./api.js";
import { generateKey, getKey, setKey, normalizeKey } from "./key.js";
import { APP_NAME, TAGLINE } from "./config.js";
import Sky from "./Sky.jsx";
import { Cloud, Deco } from "./Cloud.jsx";
import Fireflies from "./Fireflies.jsx";
import Music from "./Music.jsx";
import Intro from "./Intro.jsx";
import { loadSeen, markSeen, pruneSeen, unreadSummary } from "./seen.js";
import { PostSheet, ComposeSheet, KeySheet, DonateSheet, copyText } from "./Sheets.jsx";

// หน้าแนะนำวิธีใช้ แสดงครั้งเดียวต่อเครื่อง (เฉพาะคนที่ยังไม่มีกุญแจ)
const seenIntro = () => { try { return localStorage.getItem("cloudy-intro") === "1"; } catch { return false; } };
const markIntro = () => { try { localStorage.setItem("cloudy-intro", "1"); } catch { /* ไม่เป็นไร */ } };

const EMPTY_DRAFT = { text: "", days: 3, mode: "free" };

// แสดงครั้งเดียวหลังตั้งชื่อสำเร็จ: ให้จดกุญแจไว้ เพราะหายแล้วกู้คืนไม่ได้
function SaveKey({ onDone }) {
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");
  const key = getKey() || "";
  async function copy() {
    if (await copyText(key)) { setCopied(true); setErr(""); }
    else setErr("คัดลอกไม่ได้ ลองจดด้วยมือแทนนะ");
  }
  return (
    <div className="welcome">
      <h1>จดกุญแจไว้ก่อนนะ</h1>
      <p className="note">
        กุญแจนี้คือตัวตนของคุณที่นี่ ใช้ดูคำตอบของโพส และกลับมาใช้ชื่อเดิมเมื่อเปลี่ยนเครื่องหรือล้างเบราว์เซอร์
        ระบบไม่เก็บกุญแจจริงของคุณ ถ้าหายจะกู้คืนให้ไม่ได้ และใครมีกุญแจก็ใช้ชื่อนี้ได้ จึงควรเก็บไว้ที่ปลอดภัย
      </p>
      <div className="keybox" style={{ marginTop: 14 }}>{key}</div>
      <div className="row"><button className="chip" onClick={copy}>{copied ? "คัดลอกแล้ว" : "คัดลอกกุญแจ"}</button></div>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row" style={{ marginTop: 14 }}>
        <button className="send" onClick={onDone}>จดแล้ว เข้าไปต่อ</button>
        <button className="link" onClick={onDone}>ไว้ทีหลัง</button>
      </div>
      <p className="note">เปิดดูกุญแจได้อีกครั้งที่ปุ่ม "กุญแจของฉัน" ด้านบน</p>
    </div>
  );
}

function Welcome({ onDone }) {
  const [v, setV] = useState("");
  const [old, setOld] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = old ? v.trim().length >= 20 : v.trim().length >= 2;

  async function go() {
    setBusy(true);
    setErr("");
    try {
      if (old) {
        const k = normalizeKey(v);
        const r = await api.me(k);
        setKey(k);
        onDone(r.name);
      } else {
        if (!getKey()) setKey(generateKey());
        const r = await api.register(v.trim());
        onDone(r.name, true); // true = บัญชีใหม่ ให้ไปหน้าจดกุญแจ
      }
    } catch (e) {
      if (!old && e.status === 409) {
        try { onDone((await api.me()).name); return; } catch { /* แสดง error ด้านล่าง */ }
      }
      setErr(old && e.status === 401 ? "ไม่พบกุญแจนี้ ลองตรวจตัวอักษรอีกครั้ง" : msg(e));
      setBusy(false);
    }
  }

  return (
    <div className="welcome">
      <h1>{APP_NAME}</h1>
      <p className="sub" style={{ maxWidth: "30ch" }}>ที่นี่ไม่ต้องสมัครสมาชิก และไม่มีใครรู้ว่าคุณเป็นใคร</p>
      <label htmlFor="wn">{old ? "กุญแจเดิมของคุณ" : "ตั้งชื่อที่ใช้แสดง"}</label>
      <input
        id="wn"
        type="text"
        value={v}
        maxLength={old ? 80 : 24}
        autoFocus
        autoComplete="off"
        spellCheck="false"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && ok && !busy && go()}
      />
      <p className="note">
        {old
          ? "ใส่กุญแจที่ได้จากเครื่องเดิม ชื่อและโพสของคุณจะกลับมา"
          : "ชื่ออะไรก็ได้ ขอแค่สุภาพ ระบบจะเติมรหัสท้ายชื่อให้ และเปลี่ยนชื่อภายหลังไม่ได้"}
      </p>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row">
        <button className="send" disabled={!ok || busy} onClick={go}>{busy ? "รอสักครู่..." : old ? "ใช้กุญแจนี้" : "เข้าไป"}</button>
        <button className="link" onClick={() => { setOld(!old); setV(""); setErr(""); }}>
          {old ? "ตั้งชื่อใหม่" : "เคยใช้แล้ว? ใส่กุญแจเดิม"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase] = useState("loading"); // loading | offline | intro | welcome | ready
  const [cfg, setCfg] = useState(null);
  const [me, setMe] = useState("");
  const [posts, setPosts] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [view, setView] = useState(null); // "compose" | "key" | "donate"
  const [notice, setNotice] = useState(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT); // ร่างโพส เก็บไว้ที่นี่เพื่อไม่ให้หายตอนปิดหน้าต่าง
  const [mine, setMine] = useState([]); // โพสของฉัน พร้อมจำนวนคำตอบ/ห่วงใยล่าสุดจากเซิร์ฟเวอร์
  const [seen, setSeen] = useState(() => loadSeen());
  const [page, setPage] = useState(() => (location.hash === "#all" ? "all" : "home"));
  useEffect(() => {
    const f = () => setPage(location.hash === "#all" ? "all" : "home");
    window.addEventListener("hashchange", f);
    window.addEventListener("popstate", f);
    return () => { window.removeEventListener("hashchange", f); window.removeEventListener("popstate", f); };
  }, []);
  const go = (p) => {
    if (p === "all") location.hash = "all"; else history.pushState(null, "", location.pathname + location.search);
    setPage(p);
    window.scrollTo(0, 0);
  };

  const boot = useCallback(async () => {
    setPhase("loading");
    try {
      setCfg(await api.config());
      if (!getKey()) return setPhase(seenIntro() ? "welcome" : "intro");
      try {
        setMe((await api.me()).name);
        setPhase("ready");
      } catch (e) {
        if (e.status === 401) setPhase("welcome");
        else throw e;
      }
    } catch {
      setPhase("offline");
    }
  }, []);
  useEffect(() => { boot(); }, [boot]);

  const refreshMine = useCallback(
    () =>
      api.mine()
        .then((r) => { setMine(r.posts); setSeen(pruneSeen(r.posts.map((p) => p.id))); })
        .catch(() => {}),
    []
  );
  const refresh = useCallback(() => {
    refreshMine();
    return api.posts().then((r) => setPosts(r.posts)).catch(() => {});
  }, [refreshMine]);
  const onSeen = useCallback((id, replies, cares) => setSeen(markSeen(id, replies, cares)), []);
  const unread = unreadSummary(mine, seen);
  const unreadTotal = unread.replies + unread.cares;
  // แสดงจำนวนที่แท็บเบราว์เซอร์ด้วย เผื่อเปิดทิ้งไว้
  useEffect(() => {
    document.title = (unreadTotal ? `(${unreadTotal}) ` : "") + APP_NAME;
  }, [unreadTotal]);
  useEffect(() => {
    if (phase !== "ready") return;
    refresh();
    // โหลดใหม่ทุก 60 วินาที ยกเว้นตอนมีหน้าต่างเปิดอยู่ เพื่อไม่ให้ตำแหน่งโคมขยับระหว่างอ่าน
    const t = setInterval(() => {
      if (document.hidden) return;
      if (!openId && !view) refresh();
      else refreshMine(); // ตอนมีหน้าต่างเปิดอยู่ อัปเดตแค่ตัวเลขแจ้งเตือน ไม่ขยับโคม
    }, 60000);
    return () => clearInterval(t);
  }, [phase, openId, view, refresh, refreshMine]);

  const enter = (name, isNew = false) => { setMe(name); setView(null); setPhase(isNew ? "savekey" : "ready"); };

  async function submit(payload) {
    const r = await api.createPost(payload);
    setDraft(EMPTY_DRAFT);
    setView(null);
    refresh();
    if (r.support) {
      setNotice({ support: true });
    } else {
      setNotice({ text: "เมฆของคุณลอยขึ้นไปแล้ว" });
      setTimeout(() => setNotice(null), 3500);
    }
  }

  if (phase === "loading") return <div className="welcome"><p className="sub">กำลังโหลด...</p></div>;
  if (phase === "offline") {
    return (
      <div className="welcome">
        <h1>{APP_NAME}</h1>
        <p className="note">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ในตอนนี้ ลองอีกครั้งนะ</p>
        <div className="row"><button className="send" onClick={boot}>ลองใหม่</button></div>
      </div>
    );
  }
  if (phase === "intro") return <Intro helpline={cfg?.helpline} onDone={() => { markIntro(); setPhase("welcome"); }} />;
  if (phase === "welcome") return <Welcome onDone={enter} />;
  if (phase === "savekey") return <SaveKey onDone={() => setPhase("ready")} />;

  const helpline = cfg?.helpline;
  const nav = [["home", "⌂", "หน้าแรก"], ["write", "✎", "เขียนเมฆ"], ["all", "☰", "เรื่องราวทั้งหมด"], ["about", "♡", "เกี่ยวกับเรา"], ["key", "🔑", "กุญแจของฉัน"]];
  return (
    <>
      <Fireflies />
      <div className="safe">
        <b>♥ คุณไม่ได้อยู่คนเดียวบนท้องฟ้านี้นะ</b>
        <small>— cloudy. A safe space for everyone —</small>
        {helpline && <small>ถ้าเริ่มทนไม่ไหว โทร{helpline.name} {helpline.number} ได้ตลอด 24 ชั่วโมง</small>}
      </div>
      <Music />
      <div className="page">
        <header className="top">
          <button className="logo" onClick={() => go("home")}><Deco className="logoc" />cloudy.</button>
          <nav className="nav" aria-label="เมนูหลัก">
            {nav.map(([k, ic, label]) => (
              <button key={k} aria-current={page === k ? "page" : undefined}
                onClick={() => (k === "write" ? setView("compose") : k === "about" ? setView("donate") : k === "key" ? setView("key") : go(k))}>
                <span aria-hidden="true">{ic}</span>{label}
              </button>
            ))}
          </nav>
        </header>

        {(unreadTotal > 0 && !openId) || notice ? (
          <div className="notes">
            {unreadTotal > 0 && !openId && (
              <div className="care-msg" role="status">
                {[unread.replies && `มีคนตอบโพสของคุณ ${unread.replies} ข้อความ`, unread.cares && `ห่วงใย ${unread.cares} ครั้ง`].filter(Boolean).join(" และ ")}
                {"  "}<button className="link" onClick={() => setOpenId(unread.firstId)}>เปิดดู</button>
              </div>
            )}
            {notice?.text && <div className="care-msg" role="status">{notice.text}</div>}
            {notice?.support && (
              <div className="care-msg" role="status">
                ขอบคุณที่เล่าให้ฟัง เมฆของคุณลอยขึ้นไปแล้ว ถ้าตอนนี้รู้สึกไม่ไหว
                {helpline ? ` โทร${helpline.name} ${helpline.number} ได้ตลอด 24 ชั่วโมง` : " ติดต่อคนที่ไว้ใจหรือสายด่วนสุขภาพจิตได้"}
                {"  "}<button className="link" onClick={() => setNotice(null)}>ปิด</button>
              </div>
            )}
          </div>
        ) : null}

        {page === "home" ? (
          <>
            <section className="field">
              <div className="hero">
                <h1>ปล่อยความรู้สึกให้ลอยไป- ♡</h1>
                <p>{TAGLINE}</p>
                <button className="cta" onClick={() => setView("compose")}>✎ ปล่อยเมฆก้อนใหม่</button>
                {posts.length === 0 && <p className="emptynote">ท้องฟ้ายังว่างอยู่ เป็นคนแรกที่ปล่อยเมฆได้เลย</p>}
              </div>
              {["d1", "d2", "d3", "d4"].map((c) => <Deco key={c} className={c} />)}
              {posts.slice(0, 4).map((p, i) => (
                <Cloud key={p.id} post={p} className={"s s" + (i + 1)} style={{ "--d": -i * 2 + "s" }} onOpen={setOpenId} />
              ))}
            </section>
          </>
        ) : (
          <section className="all">
            <h1 className="ph">เรื่องราวทั้งหมด</h1>
            <Sky posts={posts} onOpen={setOpenId} />
          </section>
        )}

      </div>
      <button className="totop" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="ขึ้นบนสุด">↑</button>

      {openId && <PostSheet id={openId} cfg={cfg} onClose={() => setOpenId(null)} onChanged={refresh} onSeen={onSeen} />}
      {view === "compose" && <ComposeSheet me={me} cfg={cfg} draft={draft} setDraft={setDraft} onClose={() => setView(null)} onSubmit={submit} />}
      {view === "donate" && <DonateSheet onClose={() => setView(null)} onIntro={() => setView("intro")} />}
      {view === "intro" && <Intro overlay helpline={helpline} onDone={() => setView(null)} />}
      {view === "key" && <KeySheet onClose={() => setView(null)} onSwitched={enter} />}
    </>
  );
}
