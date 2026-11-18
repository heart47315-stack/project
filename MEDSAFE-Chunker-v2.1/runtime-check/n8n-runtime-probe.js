// Informational compatibility probe. Run only in a disposable local Node process.
// This does not call n8n and cannot prove the hosted n8n runtime behaves identically.
console.log(JSON.stringify({
  node: process.version,
  intlSegmenter: typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function',
  localeThai: (() => { try { return Intl.DateTimeFormat.supportedLocalesOf(['th']).length > 0; } catch { return false; } })()
}, null, 2));
