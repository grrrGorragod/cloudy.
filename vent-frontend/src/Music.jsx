import { useEffect, useRef, useState } from "react";
import { AmbientPlayer } from "./Ambient.js";

const PREF = "vent-music";
const readPref = () => { try { return localStorage.getItem(PREF) === "1"; } catch { return false; } };
const savePref = (on) => { try { localStorage.setItem(PREF, on ? "1" : "0"); } catch { /* ไม่เป็นไร */ } };

// ปุ่มเปิด/ปิดเพลงพื้นหลัง ปิดเป็นค่าเริ่มต้น (เบราว์เซอร์ไม่ให้เล่นเสียงเองก่อนผู้ใช้แตะ)
// ถ้าครั้งก่อนเคยเปิดไว้ จะเริ่มเล่นเมื่อแตะที่ไหนก็ได้ครั้งแรก
export default function Music() {
  const player = useRef(null);
  const touched = useRef(false); // ผู้ใช้กดปุ่มเองแล้ว ไม่ต้องเล่นอัตโนมัติ
  const [on, setOn] = useState(false);
  if (!player.current) player.current = new AmbientPlayer();

  const set = async (v) => {
    setOn(v);
    if (v) { try { await player.current.start(); } catch { setOn(false); } } else await player.current.stop();
  };

  useEffect(() => {
    const p = player.current;
    let armed = readPref();
    const first = (e) => {
      if (!armed || touched.current || e.target.closest?.(".music")) return;
      armed = false;
      set(true);
    };
    window.addEventListener("pointerdown", first, { once: false });
    // พักเสียงเมื่อสลับแท็บ เพื่อไม่กินแบต
    const vis = () => {
      const ctx = p.ctx;
      if (!ctx || !p.playing) return;
      if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("pointerdown", first);
      document.removeEventListener("visibilitychange", vis);
      p.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = () => {
    touched.current = true;
    const v = !on;
    savePref(v);
    set(v);
  };

  return (
    <button
      className="music"
      aria-pressed={on}
      aria-label={on ? "ปิดเพลง" : "เปิดเพลงเบาๆ"}
      title={on ? "ปิดเพลง" : "เปิดเพลงเบาๆ"}
      onClick={toggle}
    >
      {on ? "♪" : <span className="off">♪</span>}
    </button>
  );
}