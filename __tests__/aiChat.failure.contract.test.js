import fs from 'node:fs';
import path from 'node:path';

const edgeFunction = fs.readFileSync(path.resolve(process.cwd(), 'supabase/functions/ai-chat/index.ts'), 'utf8');
const migration = fs.readFileSync(path.resolve(process.cwd(), 'supabase/migrations/20261029000000_medical_knowledge_rag.sql'), 'utf8');

describe('ai-chat failure safety contracts', () => {
  it('keeps the approved RAG configuration and source filters', () => {
    expect(edgeFunction).toContain('dimensions: 1536');
    expect(edgeFunction).toContain('match_count: 5');
    expect(edgeFunction).toContain('match_threshold: 0.62');
    expect(migration).toContain("where status = 'approved'");
    expect(migration).toContain('approved_by is not null');
    expect(migration).toContain('approved_at is not null');
    expect(migration).toContain('embedding is not null');
    expect(migration).toContain('grant execute on function public.match_medical_knowledge');
    expect(migration).toContain('to authenticated');
  });

  it('marks RAG failures and does not expose citations for emergency responses', () => {
    expect(edgeFunction).toContain('ragStatus = "error"');
    expect(edgeFunction).toContain('ragError = true');
    expect(edgeFunction).toContain('citations: [], model: MODEL, rag: false, rag_status: "not_needed"');
    expect(edgeFunction).toContain('Thailand emergency number 1669');
  });

  it('bounds upstream retries and timeouts', () => {
    expect(edgeFunction).toContain('timeout: 15000');
    expect(edgeFunction).toContain('maxRetries: 2');
  });
});
