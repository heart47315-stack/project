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

## ตั้งค่า Supabase Auth สำหรับ Android production

1. กำหนด `EXPO_PUBLIC_SUPABASE_URL` และ `EXPO_PUBLIC_SUPABASE_ANON_KEY` ใน `.env` โดยใช้ Project URL และ publishable key (หรือ legacy anon key) จาก Supabase project เดียวกัน ห้ามใช้ `service_role`/secret key ในแอป
2. กำหนดตัวแปรชื่อเดียวกันใน EAS production environment แล้วตรวจสอบว่า build profile `production` ใช้ environment นี้
3. ใน Supabase Dashboard → Authentication → URL Configuration เพิ่ม `medsafeai://auth/callback` ใน Redirect URLs และเปิด Email provider
4. ตั้งค่า SMTP และเทมเพลตอีเมลให้ส่งลิงก์/OTP ตาม flow ที่ใช้ จากนั้นทดสอบยืนยันอีเมลและรีเซ็ตรหัสผ่านบน Android build จริง
5. ก่อน deploy migrations `20261012000000_auth_user_profiles_and_settings.sql` และ `20261012000001_reconcile_health_task_series_id.sql` ให้ตรวจ schema และสำรองข้อมูลตามขั้นตอนปกติ migration เหล่านี้เติมข้อมูลที่ขาดโดยไม่ลบหรือเขียนทับแถวเดิม
6. การเข้าสู่ระบบด้วยเบอร์โทรยังไม่เปิดในแอปนี้ หากต้องการใช้ ให้เปิด Phone provider และกำหนด SMS provider, credentials, sender/template และ OTP expiry ใน Supabase Dashboard ก่อนเพิ่ม flow ฝั่งแอป

## หมายเหตุ
ระบบ Auth และข้อมูลผู้ใช้เชื่อม Supabase ส่วน Medical AI เรียก Edge Function `ai-chat` การใช้งาน production ต้องตั้งค่า providers, redirect URL, EAS variables และ migrations ตามหัวข้อด้านบน
