import { supabase } from '../lib/supabase';

const FUNCTION_NAME = 'ai-chat';

function getAnswer(payload) {
  if (typeof payload === 'string') return payload.trim();
  return String(payload?.answer || payload?.message || payload?.content || payload?.data?.answer || '').trim();
}

export async function sendMedicalQuestion(question, history = []) {
  const trimmedQuestion = String(question || '').trim();
  if (!trimmedQuestion) return { error: { message: 'กรุณาพิมพ์คำถามก่อนส่ง' } };
  try {
    const { data: payload, error } = await supabase.functions.invoke(FUNCTION_NAME, {
      body: {
        message: trimmedQuestion,
        question: trimmedQuestion,
        history: history.map(({ me, text }) => ({ role: me ? 'user' : 'assistant', content: text })),
      },
    });

    if (error) {
      let message = error.message || 'ส่งคำถามไม่สำเร็จ';
      try {
        const details = await error.context?.json?.();
        message = details?.error?.message || details?.error || details?.message || message;
      } catch {
      }
      if (/openai api error|invalid api key|unauthorized/i.test(message)) {
        message = 'เชื่อมต่อ OpenAI ไม่สำเร็จ กรุณาตรวจสอบ OPENAI_API_KEY ใน Supabase Edge Function secrets';
      }
      return { error: { message } };
    }

    const answer = getAnswer(payload);
    if (!answer) return { error: { message: 'เซิร์ฟเวอร์ไม่ส่งข้อความตอบกลับมา' } };
    return { data: { answer, citations: payload?.citations || payload?.sources || [] } };
  } catch {
    return { error: { message: 'เชื่อมต่อ Medical AI ไม่ได้ กรุณาตรวจสอบ endpoint และอินเทอร์เน็ต' } };
  }
}
