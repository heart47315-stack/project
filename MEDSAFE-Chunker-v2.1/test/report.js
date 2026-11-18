const { createChunker } = require('../src/chunker');
const samples = {
  short: 'MEDSAFE AI local chunker test.',
  thai: 'เอกสารความรู้ทางการแพทย์ภาษาไทย '.repeat(150),
  mixed: 'Paracetamol is a medicine. ข้อมูลภาษาไทยและ English '.repeat(100),
  continuous: 'ก'.repeat(2800)
};
const chunk = createChunker();
for (const [name, sample] of Object.entries(samples)) {
  const result = chunk(sample);
  console.log(`${name}: input=${result.text.length}, chunks=${result.chunks.length}, sizes=${result.chunks.map(x => x.content.length).join(',')}`);
}
