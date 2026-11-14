import { useMemo } from "react";

// หิ่งห้อยลอยเบาๆ เป็นของตกแต่งล้วน ไม่รับการแตะ (pointer-events: none)
export default function Fireflies({ count = 14 }) {
  const flies = useMemo(() => {
    const r = (a, b) => a + Math.random() * (b - a);
    return Array.from({ length: count }, () => ({
      left: r(3, 97) + "%",
      top: r(12, 82) + "%",
      "--s": r(3, 6).toFixed(1) + "px",
      "--x1": r(-30, 30) + "px", "--y1": r(-40, 10) + "px",
      "--x2": r(-40, 40) + "px", "--y2": r(-50, 0) + "px",
      "--x3": r(-30, 30) + "px", "--y3": r(-30, 20) + "px",
      "--wd": r(14, 26).toFixed(1) + "s", "--wl": -r(0, 20).toFixed(1) + "s",
      "--bd": r(3.5, 7).toFixed(1) + "s", "--bl": -r(0, 7).toFixed(1) + "s"
    }));
  }, [count]);
  return (
    <div className="flies" aria-hidden="true">
      {flies.map((s, i) => <span key={i} className="fly" style={s} />)}
    </div>
  );
}
