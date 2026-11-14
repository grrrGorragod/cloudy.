const D = "M80 220C30 220 8 178 40 150C20 108 62 76 104 92C116 40 186 22 226 56C250 24 322 36 336 92C384 94 400 146 362 170C390 200 366 220 320 220Z";

export function remaining(post) {
  const end = new Date(post.expiresAt).getTime();
  const start = new Date(post.createdAt).getTime();
  const left = end - Date.now();
  const frac = Math.max(0.05, Math.min(1, left / Math.max(1, end - start)));
  const d = Math.ceil(left / 864e5);
  return { frac, label: d >= 1 ? `เหลืออีก ${d} วัน` : "เหลือไม่ถึงวัน" };
}

export function ago(t) {
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 6e4);
  if (m < 1) return "เมื่อสักครู่";
  if (m < 60) return `${m} นาทีที่แล้ว`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} ชั่วโมงที่แล้ว` : `${Math.floor(h / 24)} วันที่แล้ว`;
}

// เมฆหนึ่งก้อน = หนึ่งโพส ข้อความอยู่ในรูปเมฆ จางลงตามเวลาที่เหลือ
export function Cloud({ post, onOpen, className = "", style }) {
  const o = remaining(post).frac.toFixed(2);
  return (
    <button className={"cloud " + className} style={{ ...style, "--o": o }} onClick={() => onOpen(post.id)} aria-label={`เปิดอ่านโพสของ ${post.name}`}>
      <span className="in">
        <span className="t">{post.warn ? "⚠ เนื้อหาอ่อนไหว แตะเพื่ออ่าน" : post.text}</span>
        <span className="m">{post.mine ? `${post.name} (โพสของฉัน)` : post.name} • {ago(post.createdAt)} • ♡ {post.cares}</span>
      </span>
    </button>
  );
}

// เมฆหน้ายิ้มสำหรับตกแต่ง
export function Deco({ className = "" }) {
  return (
    <svg className={"deco " + className} viewBox="0 0 400 240" aria-hidden="true">
      <path d={D} className="dc" />
      <ellipse cx="165" cy="135" rx="7" ry="9" className="eye" />
      <ellipse cx="235" cy="135" rx="7" ry="9" className="eye" />
      <circle cx="138" cy="158" r="12" className="blush" />
      <circle cx="262" cy="158" r="12" className="blush" />
      <path d="M186 152q14 14 28 0" className="smile" />
    </svg>
  );
}
