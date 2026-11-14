import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// ตอนพัฒนา: เรียก /api ผ่าน proxy ไปที่ backend ในเครื่อง (ไม่ต้องตั้ง CORS)
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3000" } }
});
