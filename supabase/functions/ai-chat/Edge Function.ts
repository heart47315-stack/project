
const SYSTEM_PROMPT = `
คุณคือ MedSafe AI ผู้ช่วยให้ข้อมูลสุขภาพเบื้องต้นในแอป

บทบาท:
- ให้ข้อมูลสุขภาพทั่วไป เรื่องการใช้ยา การนัดหมายแพทย์ และการดูแลตนเอง
- อธิบายข้อมูลด้วยภาษาไทยที่สุภาพ ชัดเจน และเข้าใจง่าย

ข้อห้าม:
- ห้ามวินิจฉัยโรค
- ห้ามสั่งยา เปลี่ยนยา หรือกำหนดขนาดยาเอง
- อ้างอิงฉลากยาและคำสั่งของแพทย์หรือเภสัชกร
- หากไม่แน่ใจ ให้บอกตรงๆ ว่าไม่แน่ใจ ห้ามเดา
- ห้ามอ้างว่าได้ตรวจสอบข้อมูลทางการแพทย์ หากไม่ได้ตรวจสอบจริง

เหตุฉุกเฉิน:
- หากผู้ใช้มีอาการเจ็บหน้าอกรุนแรง หายใจลำบาก หมดสติ
  หรือแพ้ยารุนแรง ให้แนะนำโทร 1669 หรือไปห้องฉุกเฉินทันที
- ต้องให้คำแนะนำฉุกเฉินก่อนคำอธิบายอื่น
- อย่ารอถามคำถามเพิ่มเติมก่อนแนะนำให้ขอความช่วยเหลือ

รูปแบบ:
- ตอบภาษาไทย สุภาพ กระชับ ไม่เกิน 5-6 ประโยค
- ให้ความสำคัญกับความปลอดภัยเป็นอันดับแรก
- ปิดท้ายด้วยข้อความ:
  "ข้อมูลนี้ไม่ใช่การวินิจฉัยทางการแพทย์
  ควรปรึกษาแพทย์หรือเภสัชกร"
`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function hasEmergencySymptoms(message: string): boolean {
  const text = message.toLowerCase();

  const emergencyPatterns = [
    /เจ็บหน้าอก/,
    /แน่นหน้าอก/,
    /หายใจลำบาก/,
    /หายใจไม่ออก/,
    /หมดสติ/,
    /ไม่รู้สึกตัว/,
    /แพ้ยา.*(รุนแรง|หายใจ|บวม)/,
    /หน้าบวม.*หายใจ/,
  ];

  return emergencyPatterns.some((pattern) => pattern.test(text));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

    if (!openaiKey) {
      console.error("OPENAI_API_KEY is not configured");
      return jsonResponse(
        { error: "บริการ AI ยังไม่พร้อมใช้งาน" },
        503,
      );
    }

    const body = await req.json();
    const message = body?.message;
    const history = Array.isArray(body?.history) ? body.history : [];

    if (typeof message !== "string" || !message.trim()) {
      return jsonResponse(
        { error: "กรุณาระบุข้อความที่ต้องการสอบถาม" },
        400,
      );
    }

    if (message.length > 5000) {
      return jsonResponse(
        { error: "ข้อความยาวเกินไป กรุณาย่อข้อความก่อนส่ง" },
        400,
      );
    }

    // ให้คำแนะนำฉุกเฉินก่อนเรียก AI
    if (hasEmergencySymptoms(message)) {
      return jsonResponse({
        reply:
          "อาการที่คุณแจ้งอาจเป็นภาวะฉุกเฉิน กรุณาโทร 1669 หรือไปห้องฉุกเฉินทันที อย่ารอคำตอบจาก AI หากอยู่กับผู้อื่น ให้แจ้งคนใกล้ตัวช่วยเหลือ ข้อมูลนี้ไม่ใช่การวินิจฉัยทางการแพทย์ ควรปรึกษาแพทย์หรือเภสัชกร",
      });
    }

    // รับเฉพาะประวัติสนทนาที่มีรูปแบบถูกต้อง
    const safeHistory = history
      .filter(
        (item: any) =>
          item &&
          ["user", "assistant"].includes(item.role) &&
          typeof item.content === "string",
      )
      .slice(-6)
      .map((item: any) => ({
        role: item.role,
        content: item.content.slice(0, 3000),
      }));

    const openaiResponse = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 500,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...safeHistory,
            { role: "user", content: message.trim() },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      },
    );

    if (!openaiResponse.ok) {
      // ไม่บันทึก API Key หรือรายละเอียดลับจากผู้ให้บริการลง log
      console.error("OpenAI request failed", {
        status: openaiResponse.status,
      });

      return jsonResponse(
        { error: "ขออภัย บริการ AI ขัดข้องชั่วคราว กรุณาลองใหม่ภายหลัง" },
        502,
      );
    }

    const data = await openaiResponse.json();
    const reply = data.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return jsonResponse(
        { error: "AI ไม่สามารถสร้างคำตอบได้ กรุณาลองใหม่" },
        502,
      );
    }

    return jsonResponse({ reply: reply.trim() });
  } catch (error) {
    console.error(
      "Medical AI request failed",
      error instanceof Error ? error.name : "UnknownError",
    );

    return jsonResponse(
      { error: "เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่ภายหลัง" },
      500,
    );
  }
});
