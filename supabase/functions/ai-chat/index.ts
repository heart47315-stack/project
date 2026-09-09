import OpenAI from "npm:openai";

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

    const body = await req.json();

    const message = String(
      body.message || body.question || ""
    ).trim();

    const history = Array.isArray(body.history)
      ? body.history
      : [];

    if (!message) {
      return new Response(
        JSON.stringify({
          error: "Please enter a question.",
        }),
        {
          status: 400,
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
- Provide clear and easy-to-understand health and medication information.
- Explain medication usage, precautions, common side effects, and safety considerations.
- Do not claim to be a doctor.
- Do not provide definitive medical diagnoses.
- If the information provided is insufficient, clearly say so.
- If the user describes an emergency or dangerous symptoms, recommend seeking emergency medical care or calling 1669 in Thailand.
- Medication safety is the highest priority.
- Answer in Thai when the user asks in Thai.
- Answer in the user's language when they use another language.
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
        content: message,
      },
    ];

    const response = await openai.responses.create({
      model: MODEL,
      input,
    });

    const answer =
      response.output_text?.trim() ||
      "Sorry, I could not generate an answer.";

    return new Response(
      JSON.stringify({
        answer,
        model: MODEL,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error: any) {
    console.error("AI CHAT ERROR:", error);

    return new Response(
      JSON.stringify({
        error: {
          message:
            error?.message ||
            "Failed to connect to the AI service.",
        },
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});