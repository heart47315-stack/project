import { sendMedicalQuestion } from '../src/services/medicalAiService';
import { supabase } from '../src/lib/supabase';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn(), refreshSession: jest.fn() },
    functions: { invoke: jest.fn() },
  },
}));

describe('sendMedicalQuestion', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the current session access token and returns answer plus citations', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } }, error: null });
    supabase.functions.invoke.mockResolvedValue({
      data: { answer: 'คำตอบที่ตรวจสอบได้', citations: [{ title: 'แหล่งอ้างอิง' }] },
      error: null,
    });
    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      data: { answer: 'คำตอบที่ตรวจสอบได้', citations: ['แหล่งอ้างอิง'] },
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith('ai-chat', expect.objectContaining({
      headers: { Authorization: 'Bearer session-token' },
    }));
  });

  it('does not invoke the function without a session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({ error: { message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน Medical AI' } });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('refreshes an expired session once and retries without exposing the token', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'expired-session' } }, error: null });
    supabase.functions.invoke
      .mockResolvedValueOnce({ data: null, error: { message: 'Unauthorized', context: { status: 401 } } })
      .mockResolvedValueOnce({ data: { answer: 'คำตอบหลัง refresh', citations: [] }, error: null });
    supabase.auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'refreshed-session' } },
      error: null,
    });

    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      data: { answer: 'คำตอบหลัง refresh', citations: [] },
    });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('limits conversation history sent to the Edge Function', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } }, error: null });
    supabase.functions.invoke.mockResolvedValue({ data: { answer: 'คำตอบ', citations: [] }, error: null });
    const history = Array.from({ length: 15 }, (_, index) => ({ me: index % 2 === 0, text: `ข้อความ ${index}` }));

    await sendMedicalQuestion('คำถามต่อเนื่อง', history);

    const request = supabase.functions.invoke.mock.calls[0][1];
    expect(request.body.history).toHaveLength(12);
    expect(request.body.history[0]).toEqual({ role: 'assistant', content: 'ข้อความ 3' });
    expect(request.body.history.at(-1)).toEqual({ role: 'user', content: 'ข้อความ 14' });
  });

  it('returns an expired-session error when refresh cannot produce a session', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'expired-session' } }, error: null });
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { message: 'Unauthorized', context: { status: 401 } } });
    supabase.auth.refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'refresh failed' } });

    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      error: { message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ก่อนใช้งาน Medical AI' },
    });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('does not retry forever when the refreshed token is also rejected', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'expired-session' } }, error: null });
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { message: 'Unauthorized', context: { status: 401 } } });
    supabase.auth.refreshSession.mockResolvedValue({
      data: { session: { access_token: 'refreshed-session' } },
      error: null,
    });

    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      error: { message: 'คำขอ Medical AI ต้องยืนยันสิทธิ์จาก Supabase ก่อนใช้งาน และหากมีข้อผิดพลาดด้าน key ให้ตรวจสอบ Edge Function secrets' },
    });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('returns a network error without retrying when invoke rejects', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } }, error: null });
    supabase.functions.invoke.mockRejectedValue(new Error('Network disconnected'));

    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      error: { message: 'เชื่อมต่อ Medical AI ไม่ได้ กรุณาตรวจสอบ endpoint และอินเทอร์เน็ต' },
    });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
  });

  it.each([
    ['RPC failure', 502, 'RPC failure'],
    ['Embedding API timeout', 504, 'Embedding API timeout'],
    ['OpenAI API error', 500, 'คำขอ Medical AI ต้องยืนยันสิทธิ์จาก Supabase ก่อนใช้งาน และหากมีข้อผิดพลาดด้าน key ให้ตรวจสอบ Edge Function secrets'],
  ])('returns a bounded Edge Function error for %s', async (message, status, expectedMessage) => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } }, error: null });
    supabase.functions.invoke.mockResolvedValue({ data: null, error: { message, context: { status } } });

    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({ error: { message: expectedMessage } });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    expect(supabase.auth.refreshSession).not.toHaveBeenCalled();
  });

  it('rejects an empty server answer and does not manufacture citations', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } }, error: null });
    supabase.functions.invoke.mockResolvedValue({
      data: {
        answer: '',
        citations: [null, {}, '', { title: '', source: '' }, { title: 'Verified source', source: 'Approved record' }],
      },
      error: null,
    });

    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      error: { message: 'เซิร์ฟเวอร์ไม่ส่งข้อความตอบกลับมา' },
    });
  });

  it('keeps only real citation text when the answer is present', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'session-token' } }, error: null });
    supabase.functions.invoke.mockResolvedValue({
      data: {
        answer: 'คำตอบที่ปลอดภัย',
        citations: [null, {}, '', { title: '', source: '' }, { title: 'Verified source', source: 'Approved record' }],
      },
      error: null,
    });

    await expect(sendMedicalQuestion('คำถาม')).resolves.toEqual({
      data: { answer: 'คำตอบที่ปลอดภัย', citations: ['Verified source — Approved record'] },
    });
  });
});
