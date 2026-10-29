import { sendMedicalQuestion } from '../src/services/medicalAiService';
import { supabase } from '../src/lib/supabase';

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getSession: jest.fn() },
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
});
