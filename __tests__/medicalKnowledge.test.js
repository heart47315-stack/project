import { getRelevantMedicalKnowledge, normalizeCitations } from '../src/services/medicalKnowledge';

describe('medical knowledge retrieval', () => {
  it('returns dataset-derived references for common drug queries', () => {
    const results = getRelevantMedicalKnowledge('paracetamol');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].source).toContain('drugs_import.csv');
  });

  it('normalizes citation output safely', () => {
    expect(normalizeCitations([])).toEqual([]);
    expect(normalizeCitations(['Medical dataset reference'])).toEqual(['Medical dataset reference']);
  });
});
