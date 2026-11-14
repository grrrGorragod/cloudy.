const ENDPOINT = "https://api.openai.com/v1/moderations";

// นโยบาย: เรื่องหนักของตัวเองโพสได้ (เช่น เล่าว่าถูกข่มขืน) ส่วนการด่า/โจมตี/ข่มขู่คนอื่นไม่ผ่าน
// ค่าด้านล่างเป็นจุดเริ่มต้น ควรทดสอบกับข้อความภาษาไทยจริงแล้วปรับ
// ปรับผ่าน env ได้: MOD_THRESHOLDS='{"block":{"harassment":0.8},"warn":{"sexual":0.6}}'
const DEFAULTS = {
  block: {
    harassment: 0.75,
    "harassment/threatening": 0.4,
    hate: 0.6,
    "hate/threatening": 0.4,
    "sexual/minors": 0.3,
    "self-harm/instructions": 0.5,
    "illicit/violent": 0.5
  },
  // ผ่านได้ แต่ติดป้ายคำเตือนเนื้อหา (content warning)
  warn: { sexual: 0.5, violence: 0.5, "violence/graphic": 0.3, "self-harm": 0.4, "self-harm/intent": 0.3 },
  // ผ่านได้ และให้ฝั่งหน้าเว็บแสดงข้อมูลช่วยเหลือ
  support: { "self-harm": 0.4, "self-harm/intent": 0.3 }
};

function loadThresholds() {
  let o = {};
  try { o = JSON.parse(process.env.MOD_THRESHOLDS || "{}"); } catch { /* ใช้ค่าเริ่มต้น */ }
  return {
    block: { ...DEFAULTS.block, ...o.block },
    warn: { ...DEFAULTS.warn, ...o.warn },
    support: { ...DEFAULTS.support, ...o.support }
  };
}
export const T = loadThresholds();

export const MESSAGES = {
  pii: "ข้อความมีข้อมูลที่ระบุตัวตนได้ เช่น เบอร์โทร อีเมล เลขบัตร หรือไอดีโซเชียล (LINE, IG, Facebook ฯลฯ) ลองเอาออกก่อนนะ เพื่อความปลอดภัยของคุณเอง",
  link: "ที่นี่ไม่รับลิงก์ ลองเอาลิงก์ออกแล้วส่งใหม่",
  spam: "ข้อความดูเหมือนตัวอักษรซ้ำๆ ลองพิมพ์ใหม่อีกครั้ง",
  profanity: "ข้อความนี้มีแต่คำหยาบ ลองเล่าหน่อยว่าเกิดอะไรขึ้น หรือรู้สึกยังไง แล้วส่งใหม่ได้นะ ที่นี่ใช้คำหยาบประกอบได้ แต่ต้องมีเนื้อเรื่องด้วย",
  moderation:
    "ข้อความนี้ดูเหมือนเป็นการด่าหรือโจมตีผู้อื่น ที่นี่เล่าเรื่องหนักๆ ของตัวเองได้ แต่ไม่รับการทำร้ายคนอื่น ลองปรับคำแล้วส่งใหม่ได้"
};

// คำหยาบ: ไม่บล็อก (คนระบายใช้คำหยาบได้) แต่ติดป้ายเนื้อหาอ่อนไหวให้ผู้อ่านเลือกกดอ่านเอง
// เพิ่มคำเองได้ผ่าน env: PROFANITY_EXTRA="คำ1,คำ2"
// คำสั้นที่ซ้อนอยู่ในคำอื่นได้ (หีบ, ห่าง, แม่งาน) ใช้ lookahead กันไว้
const PROFANITY = [
  "ควย", "เหี้ย", "สัส", "เย็ด", "ไอ้สัตว์", "อีสัตว์", "ระยำ", "ชิบหาย", "ฉิบหาย",
  "หี(?![ก-ฮ])", "ห่า(?![ก-ฮ])", "แม่ง(?![าะ])",
  "fuck", "shit", "bitch", "dick", "cunt"
];
const EXTRA = (process.env.PROFANITY_EXTRA || "")
  .split(",").map((w) => w.trim()).filter(Boolean)
  .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const WORDS = [...PROFANITY, ...EXTRA].join("|");
const PROFANITY_RE = new RegExp(WORDS, "iu");
const PROFANITY_ALL = new RegExp(WORDS, "giu");
// คำเสริมที่ไม่ใช่เนื้อหา (ใช้ตัดทิ้งตอนเช็คว่ามีแต่คำหยาบจริงไหม)
const FILLER = /ไอ้|อี|มึง|กู|โคตร|เลย|ว่ะ|วะ|โว้ย|เอ้ย|เว้ย|ฟะ|ๆ|ฯ/gu;

// ตัดช่องว่าง/อักขระล่องหน และย่อตัวอักษรซ้ำ (ควยยยย, ค ว ย → ควย) ก่อนเทียบ
function normalize(text) {
  return text.normalize("NFC").replace(/[\s\u200B-\u200D\uFEFF._\-*]+/g, "").replace(/(.)\1{2,}/gu, "$1");
}
function hasProfanity(text) {
  return PROFANITY_RE.test(normalize(text));
}
// ข้อความมีแต่คำหยาบ/คำด่า ไม่มีเนื้อหาอื่นเลย (เช่น "ควย", "ไอ้ควยมึง", "fuck!!")
function profanityOnly(text) {
  const t = normalize(text);
  if (!PROFANITY_RE.test(t)) return false;
  const rest = t.replace(PROFANITY_ALL, "").replace(FILLER, "").replace(/[^\p{L}]/gu, "");
  return rest.length === 0;
}

// ไอดีโซเชียล: ชื่อแพลตฟอร์ม + (ไอดี/คือ/: ) + ไอดีตัวอักษรอังกฤษ/ตัวเลขอย่างน้อย 4 ตัว, หรือ @ชื่อ
const PLATFORM = "line|ไลน์|ไอจี|ig|instagram|อินสตาแกรม|อินสตา|facebook|เฟซบุ๊ก|เฟซบุ๊ค|เฟส|fb|telegram|เทเลแกรม|tiktok|ติ๊กต๊อก|discord|ดิสคอร์ด|twitter|ทวิตเตอร์|snapchat";
const HANDLE = "@?[a-z0-9][a-z0-9._-]{3,}";
const SOCIAL_RES = [
  new RegExp(`(?<![a-z0-9])(?:${PLATFORM})\\s*(?:id|ไอดี)?\\s*(?:[:：=]|คือ|เป็น|ชื่อ)\\s*${HANDLE}`, "iu"),
  new RegExp(`(?<![a-z0-9])(?:${PLATFORM})\\s*(?:id|ไอดี)\\s*${HANDLE}`, "iu"),
  new RegExp(`(?<![a-z0-9])(?:id|ไอดี)\\s*(?:ของ)?\\s*(?:${PLATFORM})\\s*(?:[:：=]|คือ)?\\s*${HANDLE}`, "iu"),
  /(?:^|[\s(])@[a-z0-9._]{4,}/i
];

// ตรวจในเครื่อง ไม่ต้องเรียก API
function localCheck(text) {
  if (SOCIAL_RES.some((re) => re.test(text))) return "pii";
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(text)) return "pii";
  if (/(?:\+?66|0)[\s-]?\d(?:[\s-]?\d){7,8}/.test(text)) return "pii";
  if (/\b\d[\s-]?\d{4}[\s-]?\d{5}[\s-]?\d{2}[\s-]?\d\b/.test(text)) return "pii";
  if (/https?:\/\/|www\./i.test(text)) return "link";
  if (/(.)\1{19,}/u.test(text.replace(/[\s\u200B-\u200D\uFEFF]+/g, ""))) return "spam"; // ตัดช่องว่างก่อน กัน "ก ก ก ก ..."
  return null;
}

const firstHit = (scores, table) =>
  Object.keys(table).find((cat) => (scores[cat] ?? 0) >= table[cat]) || null;

export async function score(text) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({ model: "omni-moderation-latest", input: text }),
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) throw new Error(`moderation http ${res.status}`);
  const data = await res.json();
  return data.results[0].category_scores;
}

// คืน { blocked: null | "pii" | "link" | "spam" | "profanity" | "moderation", warn, support }
// ถ้าเรียก API ไม่สำเร็จจะ throw (ฝั่งเรียกจะตอบ 503 ให้ลองใหม่ ไม่ปล่อยผ่านโดยไม่ตรวจ)
export async function screen(text) {
  const local = localCheck(text);
  if (local) return { blocked: local, warn: false, support: false };
  if (profanityOnly(text)) return { blocked: "profanity", warn: false, support: false };

  const scores = await score(text);
  if (firstHit(scores, T.block)) return { blocked: "moderation", warn: false, support: false };

  return {
    blocked: null,
    warn: hasProfanity(text) || Boolean(firstHit(scores, T.warn)),
    support: Boolean(firstHit(scores, T.support))
  };
}