const csvText = `drug_name,drug_type,dosage_form,active_ingredient,indication,description,restriction,precautions,source
Paracetamol,,"tab, syr",,,"หมวดยา: Central nervous system | หมวดยา: Analgesics and antipyretics | ชื่อพ้อง: Acetaminophen | ED: ก | หมายเหตุ: แนะนำให้ใช้เป็น first-line drug สำหรับ osteoarthritis",,,สำนักงานประสานการพัฒนาบัญชียาหลักแห่งชาติ — ปรับปรุงเมื่อวันที่ 23 พฤษภาคม 2555
Ibuprofen,,"film coated tab, susp",, ,"หมวดยา: Central nervous system | หมวดยา: Analgesics and antipyretics | ED: ก",,"1. เมื่อมีข้อบ่งชี้ให้ใช้ NSAIDs แนะนำให้ใช้ ibuprofen เป็นยาขนานแรกสำหรับบรรเทาอาการปวดทางทันตกรรม ปวดประจำเดือน ปวดข้อ และปวดกล้ามเนื้อ",สำนักงานประสานการพัฒนาบัญชียาหลักแห่งชาติ — ปรับปรุงเมื่อวันที่ 23 พฤษภาคม 2555
Amoxicillin trihydrate,,"cap,dry syr",,,หมวดยา: Infections | หมวดยา: Antibacterial drugs | หมวดยา: Penicillins | ED: ก,,สำนักงานประสานการพัฒนาบัญชียาหลักแห่งชาติ — ปรับปรุงเมื่อวันที่ 23 พฤษภาคม 2555
Metformin hydrochloride,,tab,,,หมวดยา: Endocrine system | หมวดยา: Drugs used in diabetes | หมวดยา: Oral antidiabetic drugs | ED: ก,,,สำนักงานประสานการพัฒนาบัญชียาหลักแห่งชาติ — ปรับปรุงเมื่อวันที่ 23 พฤษภาคม 2555
`;

const datasetRows = csvText
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map((row) => {
    const parts = row.match(/(?:"[^"]*"|[^,])+/g) || [];
    return {
      drug_name: (parts[0] || '').replace(/^"|"$/g, '').trim(),
      drug_type: (parts[1] || '').replace(/^"|"$/g, '').trim(),
      dosage_form: (parts[2] || '').replace(/^"|"$/g, '').trim(),
      active_ingredient: (parts[3] || '').replace(/^"|"$/g, '').trim(),
      indication: (parts[4] || '').replace(/^"|"$/g, '').trim(),
      description: (parts[5] || '').replace(/^"|"$/g, '').trim(),
      restriction: (parts[6] || '').replace(/^"|"$/g, '').trim(),
      precautions: (parts[7] || '').replace(/^"|"$/g, '').trim(),
      source: (parts[8] || '').replace(/^"|"$/g, '').trim(),
    };
  })
  .filter((item) => item.drug_name);

export function getRelevantMedicalKnowledge(query = '') {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return [];

  return datasetRows
    .filter((item) => {
      const haystack = [
        item.drug_name,
        item.active_ingredient,
        item.indication,
        item.description,
        item.precautions,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(needle);
    })
    .slice(0, 5)
    .map((item) => ({
      title: item.drug_name,
      summary: item.description || item.indication || 'ข้อมูลยาในชุดข้อมูลภายในแอป',
      source: `${item.source} / drugs_import.csv`,
      citation: `${item.drug_name} — ${item.source}`,
      type: 'drug-reference',
    }));
}

export function normalizeCitations(citations = []) {
  if (!Array.isArray(citations)) return [];
  return citations
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        return item.title || item.citation || item.source || item.url || '';
      }
      return '';
    })
    .filter(Boolean);
}
