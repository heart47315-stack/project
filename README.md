# MEDSAFE AI — Expo Prototype

แอปต้นแบบตามภาพ Design Board ที่ส่งมา โดยทำเป็น React Native + Expo

## ฟังก์ชันที่ทำไว้
- Splash
- Onboarding 3 หน้า
- Login / Register
- Home Dashboard
- Medical AI Chat (จำลองการตอบ)
- Drug Safety Search
- Drug Detail
- SafeRoute AI Map Prototype
- Profile
- Bottom Navigation

## วิธีรันใน VS Code

1. ติดตั้ง Node.js LTS
2. เปิด Terminal ในโฟลเดอร์นี้
3. รัน:

```bash
npm install
npx expo start
```

4. เลือกเปิดด้วย:
- Android Emulator: กด `a`
- iPhone Simulator: กด `i` (macOS)
- Browser: กด `w`
- โทรศัพท์จริง: สแกน QR จาก Expo Go

## เชื่อม Medical AI ให้ส่งข้อความได้จริง

หน้าแชตจะเรียก Supabase Edge Function ชื่อ `ai-chat` ผ่าน `supabase.functions.invoke` และส่ง JSON รูปแบบนี้:

```json
{
	"message": "คำถามของผู้ใช้",
	"question": "คำถามของผู้ใช้",
	"history": [{ "role": "user", "content": "ข้อความก่อนหน้า" }]
}
```

ฟังก์ชันควรตอบกลับเป็น `{ "answer": "คำตอบ", "citations": [] }` และเก็บ `OPENAI_API_KEY`/`SERPAPI_API_KEY` ไว้ใน Supabase Edge Function secrets เท่านั้น

```bash
supabase secrets set OPENAI_API_KEY=... SERPAPI_API_KEY=...
```

หลังแก้ `.env` ให้ restart Expo ด้วย `npx expo start -c`

## หมายเหตุ
เวอร์ชันนี้เป็น UI/UX prototype ก่อนเชื่อม Backend และ AI จริง
สำหรับ production ควรเพิ่ม authentication, medical knowledge retrieval, drug database, camera/OCR และ SafeRoute API
