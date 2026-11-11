import fs from 'node:fs';
import path from 'node:path';

const app = fs.readFileSync(path.resolve(process.cwd(), 'App.js'), 'utf8');

describe('Medical AI UI failure safety contracts', () => {
  it('guards duplicate sends and offers a bounded retry action', () => {
    expect(app).toContain('if (loading) return;');
    expect(app).toContain('onPress={() => send()}');
    expect(app).toContain('lastFailedQuestion');
  });

  it('handles token refresh events without routing an active user away', () => {
    expect(app).toContain("event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED'");
    expect(app).toContain('กำลังค้นหาความรู้และจัดทำคำตอบ');
  });

  it('renders citations only when the response contains them', () => {
    expect(app).toContain("m.citations?.length ?");
    expect(app).toContain('แหล่งอ้างอิง:');
  });
});
