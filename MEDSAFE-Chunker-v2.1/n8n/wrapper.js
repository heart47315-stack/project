// Template fragment for manual adaptation inside an n8n Code node.
// This file is NOT deployed and does not call n8n APIs.
const chunkText = createChunker();
const output = [];

for (const item of $input.all()) {
  const sourceText = item.json?.text ?? item.json?.content ?? '';
  const result = chunkText(sourceText);
  result.chunks.forEach((chunk, index) => {
    output.push({
      json: {
        ...item.json,
        content: chunk.content,
        chunk_index: index,
        total_chunks: result.chunks.length,
        char_count: chunk.content.length,
        chunk_start: chunk.start,
        chunk_end: chunk.end,
        chunk_end_reason: chunk.endReason
      }
    });
  });
}
return output;
