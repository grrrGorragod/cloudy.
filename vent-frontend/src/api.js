import { getKey } from "./key.js";

const BASE = import.meta.env.VITE_API_URL || "";

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || body?.error || "request failed");
    this.status = status; // 0 = เชื่อมต่อไม่ได้
    this.body = body;
  }
}

export const msg = (e) =>
  e?.body?.message ||
  (e?.status === 0 ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง" : "มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง");

async function call(method, path, body, keyOverride) {
  const key = keyOverride ?? getKey();
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (key) headers.Authorization = `Bearer ${key}`;

  let res;
  try {
    res = await fetch(`${BASE}/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, null);
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* ไม่มี body */ }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  config: () => call("GET", "/config"),
  me: (key) => call("GET", "/me", null, key),
  register: (name) => call("POST", "/register", { name }),
  posts: () => call("GET", "/posts"),
  mine: () => call("GET", "/me/posts"),
  post: (id) => call("GET", `/posts/${id}`),
  createPost: (b) => call("POST", "/posts", b),
  deletePost: (id) => call("DELETE", `/posts/${id}`),
  reply: (id, b) => call("POST", `/posts/${id}/replies`, b),
  deleteReply: (id) => call("DELETE", `/replies/${id}`),
  care: (id) => call("POST", `/posts/${id}/care`),
  report: (b) => call("POST", "/reports", b)
};