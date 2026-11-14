// กุญแจ 30 ตัวอักษร (base32) = 150 บิต สุ่มด้วย crypto ของ browser
const ALPHA = "abcdefghijklmnopqrstuvwxyz234567";
const LS = "vent_key";
let current = null;

export function generateKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(30));
  const chars = Array.from(bytes, (b) => ALPHA[b % 32]); // 256 หาร 32 ลงตัว ไม่มี bias
  const groups = [];
  for (let i = 0; i < 30; i += 5) groups.push(chars.slice(i, i + 5).join(""));
  return groups.join("-");
}

export const normalizeKey = (s) => s.trim().toLowerCase().replace(/\s+/g, "");

export function getKey() {
  if (current) return current;
  try { current = localStorage.getItem(LS); } catch { /* ใช้ในหน่วยความจำแทน */ }
  return current;
}

export function setKey(k) {
  current = k;
  try { localStorage.setItem(LS, k); } catch { /* ignore */ }
}
