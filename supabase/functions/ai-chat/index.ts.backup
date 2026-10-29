import OpenAI from "npm:openai";

const MEDICAL_KB = [
  {
    title: "Paracetamol / Acetaminophen",
    summary: "Paracetamol is commonly used for fever and mild-to-moderate pain. For adults, dosing must stay within the label and avoid overdose. Do not exceed the recommended daily limit and seek medical help if overdose is suspected.",
    source: "dataset/drugs_import.csv",
  },
  {
    title: "Ibuprofen",
    summary: "Ibuprofen is a common NSAID for pain, fever, and inflammatory symptoms. It can irritate the stomach and should be used carefully in people with kidney issues, stomach ulcers, or with other medications that affect the stomach or kidneys.",
    source: "dataset/drugs_import.csv",
  },
  {
    title: "Amoxicillin",
    summary: "Amoxicillin is an antibiotic used for some bacterial infections, but it should only be used when prescribed and the full course should be completed. Allergic reactions require urgent medical review.",
    source: "dataset/drugs_import.csv",
  },
  {
    title: "Metformin",
    summary: "Metformin is widely used for type 2 diabetes management. It can cause stomach upset and is not appropriate for all patients; a clinician should review kidney function and medication interactions before use.",
    source: "dataset/drugs_import.csv",
  },
  {
    title: "General safety",
    summary: "This app provides general, non-diagnostic health information only. Severe symptoms, pregnancy concerns, overdose, or emergency signs should be reviewed by a qualified healthcare professional immediately.",
    source: "dataset/drugs_import.csv",
  },
];

function findKnowledge(message: string) {
  const query = message.toLowerCase();
  if (!query.trim()) return [];

  return MEDICAL_KB.filter((item) => {
    const haystack = `${item.title} ${item.summary}`.toLowerCase();
    return haystack.includes(query) || query.includes(item.title.toLowerCase().split(' ')[0]);
  }).slice(0, 3);
}

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
});

const MODEL = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: { message: "Authentication required" } }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();

    const message = String(body.message || body.question || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];

    if (!message) {
      return new Response(
        JSON.stringify({ error: { message: "Please enter a question." } }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const localKnowledge = findKnowledge(message);
    const citations = localKnowledge.map((item) => item.source);

    if (!Deno.env.get("OPENAI_API_KEY")) {
      const fallbackAnswer = localKnowledge.length
        ? `คำตอบนี้เป็นข้อมูลทั่วไปจากชุดข้อมูลยาในแอป (${citations.join(", ")}) และไม่ใช่คำวินิจฉัยทางการแพทย์อย่างเป็นทางการ。กรุณาปรึกษาแพทย์หรือเภสัชกรก่อนใช้ยา หากมีอาการรุนแรงหรือมีอาการแพ้/overdose ให้ไปพบแพทย์ทันที.`
        : "ข้อมูลนี้เป็นคำตอบทั่วไปจากชุดข้อมูลเข้าใช้งานภายในแอปและไม่ใช่คำวินิจฉัยทางการแพทย์อย่างเป็นทางการ กรุณาปรึกษาแพทย์หรือเภสัชกรเพื่อคำแนะนำเฉพาะบุคคล หากมีอาการรุนแรงให้ขอความช่วยเหลือทางการแพทย์ทันที.";

      return new Response(
        JSON.stringify({
          answer: fallbackAnswer,
          citations,
          source: citations,
          model: "local-dataset",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const input = [
      {
        role: "developer",
        content: `
You are MedSafe AI, a health and medication information assistant.

Rules:
- Ground your answer in the current medication reference information and clearly say when information is limited.
- Do not claim to be a doctor.
- Do not provide definitive diagnoses.
- Recommend urgent medical care for severe symptoms or emergencies.
- Prefer structured, safe summary in Thai when the user asks in Thai.
- If the information is not verifiable, say so clearly and avoid invented medical claims.
        `.trim(),
      },
      ...history
        .filter(
          (item: any) =>
            item &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string"
        )
        .slice(-20),
      {
        role: "user",
        content: `${message}\n\nKnown references:\n${localKnowledge.map((item) => `- ${item.title}: ${item.summary} [${item.source}]`).join("\n")}`,
      },
    ];

    const response = await openai.responses.create({
      model: MODEL,
      input,
    });

    const answer = response.output_text?.trim() || "ขออภัย ไม่สามารถสรุปคำตอบได้ชัดเจนจากข้อมูลที่ตรวจสอบแล้ว";

    return new Response(
      JSON.stringify({
        answer,
        citations,
        sources: citations,
        model: MODEL,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("AI CHAT ERROR:", error);

    return new Response(
      JSON.stringify({
        error: {
          message: error?.message || "Failed to connect to the AI service.",
        },
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});