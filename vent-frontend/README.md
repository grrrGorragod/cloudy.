# vent-frontend

หน้าเว็บ React (JavaScript ล้วน ไม่มี TypeScript) + Vite เชื่อมกับ `vent-backend`

## รันในเครื่อง

1. เปิด backend ไว้ก่อน (`npm run dev` ในโฟลเดอร์ vent-backend ที่พอร์ต 3000)
2. ในโฟลเดอร์นี้:

```bash
npm install
npm run dev
```

เปิด http://localhost:5173 — การเรียก `/api` จะผ่าน proxy ไปที่ backend ในเครื่องอัตโนมัติ (ไม่ต้องตั้ง CORS)

## ขึ้นเว็บจริง

1. สร้างไฟล์ `.env.production` ใส่ `VITE_API_URL=https://<backend ของคุณบน Render>`
2. `npm run build` แล้วนำโฟลเดอร์ `dist` ไปวางบน static hosting (Cloudflare Pages, Netlify, Render Static Site ฯลฯ)
3. ที่ backend ตั้ง `CORS_ORIGINS` เป็นโดเมนของหน้าเว็บ

## โครงสร้าง

- `src/config.js` ชื่อเว็บและคำอธิบายใต้ชื่อ (เปลี่ยนที่นี่ที่เดียว และแก้ `<title>` ใน `index.html`)
- `src/key.js` สร้างกุญแจสุ่ม 150 บิต เก็บใน localStorage
- `src/api.js` ตัวเรียก API และแปลง error เป็นข้อความไทย
- `src/Sky.jsx` ท้องฟ้าโคม (จัดช่องตาราง ไม่ทับกัน)
- `src/Sheets.jsx` หน้าต่างอ่านโพส/ตอบ, ระบายความรู้สึก, กุญแจของฉัน
- `src/App.jsx` ลำดับการเข้าใช้: โหลด → กรอกชื่อ (หรือใส่กุญแจเดิม) → หน้าหลัก
