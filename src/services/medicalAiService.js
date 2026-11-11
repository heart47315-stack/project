import { supabase } from '../lib/supabase';
import { normalizeCitations } from './medicalKnowledge';

const FUNCTION_NAME = 'ai-chat';

function getAnswer(payload) {
  if (typeof payload === 'string') return payload.trim();
  return String(payload?.answer || payload?.message || payload?.content || payload?.data?.answer || '').trim();
}

function getCitations(payload) {
  const raw = payload?.citations || payload?.sources || payload?.references || [];
  return normalizeCitations(raw);
}

function toHistory(history) {
  const items = Array.isArray(history) ? history : [];
  return items
    .filter((item) => item && typeof item.text === 'string' && item.text.trim())
    .slice(-12)
    .map(({ me, text }) => ({
      role: me ? 'user' : 'assistant',
      content: text.slice(0, 4000),
    }));
}

function getErrorStatus(error) {
  return error?.context?.status || error?.status || error?.context?.response?.status || null;
}

async function invokeChat(accessToken, trimmedQuestion, history) {
  return supabase.functions.invoke(FUNCTION_NAME, {
    headers: { Authorization: `Bearer ${accessToken}` },
    body: {
      message: trimmedQuestion,
      question: trimmedQuestion,
      history: toHistory(history),
    },
  });
}

export async function sendMedicalQuestion(question, history = []) {
  const trimmedQuestion = String(question || '').trim();
  if (!trimmedQuestion) return { error: { message: 'กรุณาพิมพ์คำถามก่อนส่ง' } };
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (sessionError || !accessToken) {
      return { error: { message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน Medical AI' } };
    }

    let { data: payload, error } = await invokeChat(accessToken, trimmedQuestion, history);

    if (error && getErrorStatus(error) === 401) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      const refreshedToken = refreshed?.session?.access_token;
      if (refreshError || !refreshedToken) {
        return { error: { message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ก่อนใช้งาน Medical AI' } };
      }
      ({ data: payload, error } = await invokeChat(refreshedToken, trimmedQuestion, history));
    }

    if (error) {
      let message = error.message || 'ส่งคำถามไม่สำเร็จ';
      try {
        const details = await error.context?.json?.();
        message = details?.error?.message || details?.error || details?.message || message;
      } catch {
      }
      if (/openai api error|invalid api key|unauthorized|authentication required|forbidden/i.test(message)) {
        message = 'คำขอ Medical AI ต้องยืนยันสิทธิ์จาก Supabase ก่อนใช้งาน และหากมีข้อผิดพลาดด้าน key ให้ตรวจสอบ Edge Function secrets';
      }
      return { error: { message } };
    }

    const answer = getAnswer(payload);
    if (!answer) return { error: { message: 'เซิร์ฟเวอร์ไม่ส่งข้อความตอบกลับมา' } };

    const citations = getCitations(payload);
    return { data: { answer, citations } };
  } catch {
    return { error: { message: 'เชื่อมต่อ Medical AI ไม่ได้ กรุณาตรวจสอบ endpoint และอินเทอร์เน็ต' } };
  }
}
