import { supabase } from '../lib/supabase';
import { normalizeCitations } from './medicalKnowledge';

function getWebhookUrl() {
  return process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL;
}

function getSupabasePublicKey() {
  return (
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );
}

function isProductionWebhookUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.pathname.includes('/webhook/') &&
      !url.pathname.includes('/webhook-test/')
    );
  } catch {
    return false;
  }
}

function toHistory(history) {
  return (Array.isArray(history) ? history : [])
    .filter((item) => item && typeof item.text === 'string' && item.text.trim())
    .slice(-12)
    .map((item) => ({
      role: item.me ? 'user' : 'assistant',
      content: item.text.slice(0, 4000),
    }));
}

function getRoot(payload) {
  return Array.isArray(payload) ? payload[0] : payload;
}

function getAnswer(payload) {
  const root = getRoot(payload);
  if (typeof root === 'string') return root.trim();

  const candidates = [
    root?.answer,
    root?.output,
    root?.message,
    root?.text,
    root?.response,
    root?.data?.answer,
    root?.data?.output,
    root?.data?.message,
  ];
  const answer = candidates.find(
    (value) => typeof value === 'string' && value.trim()
  );

  return answer?.trim() || '';
}

function getCitations(payload) {
  const root = getRoot(payload);
  const raw =
    root?.citations ??
    root?.sources ??
    root?.references ??
    root?.data?.citations ??
    [];

  return normalizeCitations(Array.isArray(raw) ? raw : []);
}

async function callN8n(webhookUrl, token, question, history, sessionId) {
  const publicKey = getSupabasePublicKey();
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(publicKey ? { apikey: publicKey } : {}),
    },
    body: JSON.stringify({
      message: question,
      question,
      chatInput: question,
      history: toHistory(history),
      sessionId: `medsafe-${sessionId}`,
    }),
  });

  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = raw;
  }

  if (!response.ok) {
    const root = getRoot(payload);
    const message =
      root?.error?.message ||
      root?.error ||
      root?.message ||
      `n8n API error: HTTP ${response.status}`;
    throw Object.assign(new Error(String(message)), { status: response.status });
  }

  return payload;
}

export async function sendMedicalQuestion(question, history = []) {
  const trimmedQuestion = String(question || '').trim();
  const webhookUrl = getWebhookUrl();
  if (!trimmedQuestion) {
    return { error: { message: 'กรุณาพิมพ์คำถามก่อนส่ง' } };
  }
  if (trimmedQuestion.length > 2000) {
    return { error: { message: 'คำถามยาวเกิน 2,000 ตัวอักษร' } };
  }
  if (!isProductionWebhookUrl(webhookUrl)) {
    return {
      error: { message: 'ยังไม่ได้ตั้งค่า n8n Production Webhook URL ที่ถูกต้อง' },
    };
  }

  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    let session = sessionData?.session;
    if (sessionError || !session?.access_token) {
      return {
        error: { message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน Medical AI' },
      };
    }

    let payload;
    try {
      payload = await callN8n(
        webhookUrl,
        session.access_token,
        trimmedQuestion,
        history,
        session.user.id
      );
    } catch (error) {
      if (error.status !== 401) throw error;

      const { data: refreshed, error: refreshError } =
        await supabase.auth.refreshSession();
      session = refreshed?.session;
      if (refreshError || !session?.access_token) {
        return {
          error: { message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' },
        };
      }

      payload = await callN8n(
        webhookUrl,
        session.access_token,
        trimmedQuestion,
        history,
        session.user.id
      );
    }

    const answer = getAnswer(payload);
    if (!answer) {
      return { error: { message: 'n8n ไม่ได้ส่งข้อความตอบกลับมา' } };
    }

    return { data: { answer, citations: getCitations(payload) } };
  } catch (error) {
    console.error('MEDSAFE n8n error:', error);
    return {
      error: {
        message:
          error.message || 'เชื่อมต่อ n8n ไม่สำเร็จ กรุณาตรวจสอบ Workflow',
      },
    };
  }
}
