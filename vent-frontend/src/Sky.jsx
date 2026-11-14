import { useEffect, useState } from "react";
import { Cloud } from "./Cloud.jsx";

export { remaining } from "./Cloud.jsx";

const CELL_H = 200, GX = 16;

// สุ่มแบบคงที่จาก id ของโพส ตำแหน่งจะไม่เปลี่ยนเมื่อโหลดรายการใหม่
function rng(id) {
  let a = Number(String(id).slice(-9)) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// แบ่งหน้าเป็นช่องตาราง เมฆแต่ละก้อนมีช่องของตัวเอง จึงไม่ทับกัน
function arrange(count, W) {
  const cw = Math.min(280, W * 0.8);
  const cols = Math.max(1, Math.floor(W / (cw + 2 * GX)));
  const colW = W / cols;
  const rows = Math.max(1, Math.ceil(count / cols));
  return { cols, colW, slack: Math.max(0, colW - cw - 2 * GX), height: rows * CELL_H + 20 };
}

export default function Sky({ posts, onOpen }) {
  const [W, setW] = useState(window.innerWidth);
  useEffect(() => {
    const f = () => setW(window.innerWidth);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  if (posts.length === 0) return <p className="emptynote">ท้องฟ้ายังว่างอยู่ เป็นคนแรกที่ปล่อยเมฆได้เลย</p>;
  const g = arrange(posts.length, W);
  return (
    <div style={{ position: "relative", height: g.height, width: "100%" }}>
      {posts.map((p, i) => {
        const r = rng(p.id);
        return (
          <Cloud
            key={p.id}
            post={p}
            onOpen={onOpen}
            className="g"
            style={{
              left: (i % g.cols) * g.colW + GX + r() * g.slack + "px",
              top: Math.floor(i / g.cols) * CELL_H + r() * 14 + "px",
              "--dx": -16 + r() * 32 + "px", "--dy": 6 + r() * 8 + "px",
              "--dur": 16 + r() * 12 + "s", "--delay": -r() * 20 + "s"
            }}
          />
        );
      })}
    </div>
  );
}
