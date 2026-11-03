# FINAL MEDICAL AI TRAINING REPORT

วันที่ตรวจสอบ: 2026-11-03

## ขอบเขตและข้อจำกัด

ดำเนินการใน `C:\Users\asus\OneDrive\Documents\GitHub\project` ตาม workspace ที่ผู้ใช้ยืนยัน ไม่ใช่ `C:\Users\asus\Documents\GitHub\project-restored` ที่ระบุในคำขอเดิม จึงควรตรวจสอบ repository เป้าหมายอีกครั้งก่อนนำ changes นี้ไปใช้ที่อื่น

ไม่มีการ Deploy และไม่มีการเขียน/แก้ไข/ลบข้อมูล Production การทดสอบ OpenAI แบบ read-only ถูกเรียกจริงหนึ่งครั้งและตอบกลับ `401 invalid_api_key`; ไม่มีการแสดงค่า key ในรายงาน ส่วน Supabase live test ไม่ได้ถูกเรียกเพราะไม่มี server-side credentials ที่จำเป็น

## สิ่งที่ดำเนินการ

- ตรวจสอบ schema จาก migration เดิมก่อนแก้ไข: `medical_knowledge`, `vector(1536)`, RPC `match_medical_knowledge`, RLS และ permissions
- คงโมเดล `gpt-4o-mini` และ `text-embedding-3-small`
- เพิ่ม JSON dataset และขยายฟิลด์ข้อมูลยาให้รองรับชื่อสามัญ ชื่อทางการค้า สารออกฤทธิ์ ประเภท รูปแบบยา ข้อบ่งใช้ ข้อห้ามใช้ คำเตือน อาการไม่พึงประสงค์ ปฏิกิริยาระหว่างยา ข้อควรระวัง source URL วันที่ตรวจสอบ และ approval status
- เพิ่ม JSON/CSV normalization และ validation: required fields, duplicate content, duplicate ID, URL, source, approval status และ reviewer UUID สำหรับ approved records
- ปรับ import pipeline ให้มี chunking, SHA-256 hash, batch processing, retry with exponential backoff, embedding dimension validation, idempotent upsert และ import summary
- ปรับ default workflow ให้เป็น dry-run; การเรียก API/database จริงต้องใช้ `medical:import:apply` หรือ `medical:test:live` โดยตั้งใจ
- ปรับ Edge Function ให้ตรวจ embedding 1536 มิติ, แยก RAG status (`matched`, `no_match`, `error`), จัดการ invalid JSON และไม่เปิดเผย error ภายในแก่ client พร้อมรักษา response fields เดิม (`answer`, `citations`, `model`, `rag`)
- เพิ่ม fine-tuning structured schema และทำให้ validator/splitter รองรับ records แบบ `instruction/input/expected_output/source/reviewer/approval_status` โดยยังไม่อ้างว่ามีการ fine-tune

## ไฟล์ที่สร้าง

- `dataset/medicines.json`
- `scripts/medical-training.mjs`
- `scripts/validate-medical-data.mjs`
- `scripts/test-medical-rag.mjs`
- `datasets/finetune/medical_knowledge.schema.json`
- `FINAL_MEDICAL_AI_TRAINING_REPORT.md`

## ไฟล์ที่แก้ไข

- `package.json`, `package-lock.json`
- `scripts/import-medical-knowledge.mjs`
- `scripts/validate-finetune-dataset.mjs`
- `scripts/split-finetune-dataset.mjs`
- `supabase/functions/ai-chat/index.ts`

ไม่มีการสร้างตารางหรือ RPC ใหม่ และไม่มีการลบข้อมูลเดิม

## โครงสร้าง Dataset และจำนวนข้อมูล

- `dataset/medicines.json`: 2 source records
- Validation: ผ่าน 2, ไม่ผ่าน 0
- Pending: 2
- Approved: 0
- Rejected: 0
- Duplicate: 0
- Dry-run chunk count: 2
- Embedding: ยังไม่ได้สร้างจริง เพราะ dry-run ไม่เรียก OpenAI; pipeline ตรวจว่าค่าที่ได้จริงต้องเป็น 1536 มิติ

ข้อมูลตัวอย่างยังเป็น `pending`/`verified: false` และไม่ถูกนำไปใช้โดย RPC ซึ่งกรอง `status = approved`, `approved_by` และ `approved_at` อยู่แล้ว

## คำสั่งที่เพิ่ม

```text
npm run medical                  # validate + import dry-run
npm run medical:validate
npm run medical:import           # dry-run เท่านั้น
npm run medical:import:apply     # ต้องมี server-side secrets และอนุมัติการเขียนข้อมูลก่อน
npm run medical:test             # protected dry-run
npm run medical:test:live        # live integration test สำหรับ test/non-production เท่านั้น
```

## ผลการทดสอบ

- `npm run medical`: ผ่าน; 2 records passed, pending 2, approved 0, dry-run 2 chunks
- JSON syntax checks ของ scripts: ผ่าน
- CSV validation/import dry-run กับ `dataset/drugs.csv`: ผ่าน 1 record, ไม่มีการเขียนข้อมูล
- `npm test -- --runInBand`: ผ่าน 14 suites, 86 tests
- `npm run lint -- --quiet`: ไม่พบ lint error ของการเปลี่ยนแปลงนี้
- `npm run typecheck`: ผ่าน
- `git diff --check`: ผ่าน; มีเพียงคำเตือน line-ending ของ Git
- RAG default test: ผ่านในโหมด protected dry-run โดยไม่เรียก external service
- Fine-tuning draft validation: ปฏิเสธ 12 draft records ตาม expected approval gate เพราะ `expert_reviewed` ยังเป็น false

## Final Integration Test Matrix

| รายการ | ผล | หลักฐาน/เหตุผล |
|---|---|---|
| A. Supabase schema และ RPC | PASS (static) / NOT TESTED (live) | migration เดิมยืนยันตาราง, RPC, RLS และ permissions; ไม่มี server-side Supabase credentials สำหรับ query จริง |
| B. Embedding dimension 1536 | PASS (static) / NOT TESTED (live) | code บังคับ `dimensions: 1536` และตรวจ response length; OpenAI request ไม่ผ่าน authentication จึงไม่มี vector จริงให้ตรวจ |
| C. OpenAI connectivity | FAIL | live read-only embedding request ตอบ `401 invalid_api_key` |
| D. Approved retrieval | NOT TESTED | ไม่เรียก RPC จริงเพราะไม่มี server-side Supabase credentials |
| E. Pending exclusion | PASS (static) / NOT TESTED (live) | RPC มีเงื่อนไข approved/approved_by/approved_at; ยังไม่ได้ยืนยันด้วย database query จริง |
| F. Context construction | PASS (static) / NOT TESTED (live) | Edge Function สร้าง context จาก RPC fields ที่ตรง schema; ยังไม่ได้รัน Edge Function จริง |
| G. AI response | NOT TESTED | ไม่เรียก `gpt-4o-mini` เพราะ prerequisite embedding/RPC authentication ไม่ผ่าน |
| H. Citations | PASS (static) / NOT TESTED (live) | code สร้าง citations จาก `title/source/source_url/metadata`; ยังไม่มี live response |
| I. Error handling | PASS (static) | มี validation, timeout/retry, invalid JSON response, embedding/RPC status และ safe client error; live error-path test ยังไม่ทำ |
| J. Security/rate limiting | FAIL | ไม่พบ rate limiting เฉพาะ endpoint; secret separation/auth checks และไม่เปิดเผย internal error ผ่าน static review ผ่าน |

## สถานะ RAG และ API Compatibility

Edge Function ยังคงลำดับ Validate input → embedding → RPC retrieval → approved context → GPT-4o-mini → citations และยังคืน response shape เดิมที่ frontend ใช้ได้ การค้นไม่พบข้อมูลจะคืนคำตอบภาษาไทยแบบจำกัดพร้อมแนะนำแพทย์/เภสัชกร และ prompt ยังคงห้ามวินิจฉัย สั่งยา หรือแต่งข้อเท็จจริง รวมถึงแนะนำ 1669 เมื่อฉุกเฉิน

ตรวจสอบ response schema ของ RPC ตาม migration แล้วตรงกับ field ที่ Edge Function ใช้: `title`, `content`, `category`, `source`, `source_url`, `metadata`, `similarity`

## ปัญหาหรือส่วนที่ยังไม่ได้ทดสอบ

- Live embedding ถูกลองแบบ read-only แต่ล้มเหลวด้วย `401 invalid_api_key`; ยังไม่ได้รัน database insert หรือ RPC retrieval เพราะไม่มี server-side Supabase credentials และไม่ได้รับอนุญาตให้เขียน Production
- เครื่องนี้ไม่มี `deno` จึงไม่ได้รัน `deno check` กับ Edge Function; TypeScript project check ผ่าน แต่ไม่แทน Deno runtime check
- ยังไม่มี rate limiting เฉพาะ endpoint ใน Edge Function; ควรเพิ่มผ่าน Supabase/edge gateway หรือกลไก server-side ก่อน production scale
- ตาราง `drugs` เดิมยังเป็น fallback ของระบบเดิมและไม่มี approval workflow แบบเดียวกับ `medical_knowledge`; หากต้องการรับประกัน approved-only ทั้งระบบควรเพิ่มสถานะตรวจสอบให้ตารางนั้นในงานแยก
- Fine-tuning ยังไม่เกิดขึ้นจริง และ dataset เดิมยังเป็น draft ที่ต้องผ่าน clinical review

## ขั้นตอนถัดไปที่ปลอดภัย

1. นำ migration เดิมไปใช้ใน test/staging และตรวจ schema/RLS/RPC ด้วย Supabase credentials ที่ได้รับอนุญาต
2. เพิ่มข้อมูลยาที่มีแหล่งอ้างอิงจริงเท่านั้น แล้วรัน `npm run medical:validate`
3. รัน `npm run medical:import` ตรวจ dry-run ก่อน และใช้ `npm run medical:import:apply` เฉพาะ test/staging ที่อนุมัติ
4. ให้ clinical reviewer อนุมัติ records โดยกำหนด `approved_by` และ `approved_at`; ห้ามเปลี่ยนเป็น approved เพียงเพราะ import สำเร็จ
5. รัน `npm run medical:test:live` กับ test data และตรวจ pending exclusion, RPC schema, similarity และ citations
6. สำหรับ fine-tuning ให้ตรวจ PII, data leakage, reviewer และ approval status แล้วแยก train/validation/test ก่อนขออนุมัติ upload
