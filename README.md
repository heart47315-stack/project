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

## หมายเหตุ
เวอร์ชันนี้เป็น UI/UX prototype ก่อนเชื่อม Backend และ AI จริง
สำหรับ production ควรเพิ่ม authentication, API, database, medical knowledge retrieval, drug database, camera/OCR และ SafeRoute API
