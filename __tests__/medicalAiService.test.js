import { sendMedicalQuestion } from '../src/services/medicalAiService';
import { supabase } from '../src/lib/supabase';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(), refreshSession: jest.fn() },
  },
}));

const originalWebhookUrl = process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL;
const originalPublicKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const originalFetch = global.fetch;
const webhookUrl = 'https://n8n.example/webhook/test-id';

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof payload === 'string' ? payload : JSON.stringify(payload)),
  };
}

describe('sendMedicalQuestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL = webhookUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-key';
    global.fetch = jest.fn();
  });

  afterAll(() => {
    if (originalWebhookUrl === undefined) {
      delete process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL;
    } else {
      process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL = originalWebhookUrl;
    }
    if (originalPublicKey === undefined) {
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalPublicKey;
    }
    global.fetch = originalFetch;
  });

  it('sends the session, question, bounded history, and returns answer plus citations', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'session-token', user: { id: 'user-id' } } },
      error: null,
    });
    global.fetch.mockResolvedValue(
      response({ output: 'คำตอบจาก n8n', citations: [{ title: 'แหล่งอ้างอิง' }] })
    );
    const history = Array.from({ length: 15 }, (_, index) => ({
      me: index % 2 === 0,
      text: `ข้อความ ${index}`,
    }));

    await expect(sendMedicalQuestion('คำถามต่อเนื่อง', history)).resolves.toEqual({
      data: { answer: 'คำตอบจาก n8n', citations: ['แหล่งอ้างอิง'] },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer session-token',
          apikey: 'public-key',
        },
      })
    );
    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody).toMatchObject({
      message: 'คำถามต่อเนื่อง',
      question: 'คำถามต่อเนื่อง',
      chatInput: 'คำถามต่อเนื่อง',
      sessionId: 'medsafe-user-id',
      history: expect.any(Array),
    });
    expect(requestBody.history).toHaveLength(12);
    expect(requestBody.history[0]).toEqual({
      role: 'assistant',
      content: 'ข้อความ 3',
    });
    expect(requestBody.history.at(-1)).toEqual({
      role: 'user',
      content: 'ข้อความ 14',
    });
  });

  it('does not contact n8n without a signed-in session', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      error: { message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน Medical AI' },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects a test webhook URL before sending the access token', async () => {
    process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL =
      'https://n8n.example/webhook-test/test-id';

    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      error: { message: 'ยังไม่ได้ตั้งค่า n8n Production Webhook URL ที่ถูกต้อง' },
    });
    expect(supabase.auth.getSession).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('refreshes an expired session once and retries with the new token', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'expired-token', user: { id: 'user-id' } } },
      error: null,
    });
    global.fetch
      .mockResolvedValueOnce(response({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(response({ answer: 'คำตอบหลัง refresh' }));
    supabase.auth.refreshSession.mockResolvedValue({
      data: {
        session: { access_token: 'refreshed-token', user: { id: 'user-id' } },
      },
      error: null,
    });

    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      data: { answer: 'คำตอบหลัง refresh', citations: [] },
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe(
      'Bearer refreshed-token'
    );
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('returns an expired-session error when refresh cannot produce a session', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'expired-token', user: { id: 'user-id' } } },
      error: null,
    });
    global.fetch.mockResolvedValue(response({ message: 'Unauthorized' }, 401));
    supabase.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'refresh failed' },
    });

    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      error: { message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' },
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects empty questions, oversized questions, and empty server answers', async () => {
    await expect(sendMedicalQuestion('   ')).resolves.toEqual({
      error: { message: 'กรุณาพิมพ์คำถามก่อนส่ง' },
    });
    await expect(sendMedicalQuestion('x'.repeat(2001))).resolves.toEqual({
      error: { message: 'คำถามยาวเกิน 2,000 ตัวอักษร' },
    });
    expect(global.fetch).not.toHaveBeenCalled();

    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'session-token', user: { id: 'user-id' } } },
      error: null,
    });
    global.fetch.mockResolvedValue(
      response({ answer: '', citations: [{ title: 'Not used' }] })
    );
    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      error: { message: 'n8n ไม่ได้ส่งข้อความตอบกลับมา' },
    });
  });
});
