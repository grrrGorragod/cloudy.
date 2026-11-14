// จำว่าอ่านคำตอบ/ห่วงใยของโพสตัวเองถึงไหนแล้ว เก็บในเครื่องนี้เท่านั้น (เซิร์ฟเวอร์ไม่รู้ว่าใครอ่านอะไร)
// รูปแบบ: { [postId]: { replies: จำนวนคำตอบจากคนอื่นที่เห็นแล้ว, cares: จำนวนห่วงใยที่เห็นแล้ว } }
const LS = "vent_seen";
let mem = {};

export function loadSeen() {
  try { mem = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch { /* ใช้ในหน่วยความจำแทน */ }
  return mem;
}

function save() {
  try { localStorage.setItem(LS, JSON.stringify(mem)); } catch { /* ignore */ }
}

export function markSeen(id, replies, cares) {
  mem = { ...mem, [id]: { replies, cares } };
  save();
  return mem;
}

// ทิ้งรายการของโพสที่หมดอายุหรือถูกลบไปแล้ว ไม่ให้ค้างในเครื่อง
export function pruneSeen(liveIds) {
  const live = new Set(liveIds);
  const next = Object.fromEntries(Object.entries(mem).filter(([id]) => live.has(id)));
  if (Object.keys(next).length !== Object.keys(mem).length) { mem = next; save(); }
  return mem;
}

// คืนสรุปสิ่งใหม่: จำนวนคำตอบใหม่ ห่วงใยใหม่ และ id โพสแรกที่มีอะไรใหม่ (ไว้กดเปิดดู)
export function unreadSummary(mine, seen) {
  let replies = 0, cares = 0, firstId = null;
  for (const p of mine) {
    const s = seen[p.id] || { replies: 0, cares: 0 };
    const r = Math.max(0, p.replies - s.replies);
    const c = Math.max(0, p.cares - s.cares);
    if ((r || c) && firstId === null) firstId = p.id;
    replies += r;
    cares += c;
  }
  return { replies, cares, firstId };
}
