// Rapor dışa aktarma yardımcıları (bağımlılıksız).
// CSV: UTF-8 BOM + ';' ayraç → Türkçe Excel doğru açar.
// PDF: yazdırma penceresi (tarayıcı "PDF olarak kaydet") → Türkçe sorunsuz.

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCSV(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers, ...rows].map((r) => r.map(esc).join(';'));
  const csv = lines.join('\r\n');
  triggerDownload(
    new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }),
    filename.endsWith('.csv') ? filename : filename + '.csv',
  );
}

// Verilen HTML gövdesini yazdırma penceresinde açar ve yazdırma diyaloğunu tetikler.
export function printHTML(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=920,height=760');
  if (!w) {
    alert('Yazdırma penceresi açılamadı (açılır pencere engelli olabilir).');
    return;
  }
  const style = `
    body{font-family:system-ui,-apple-system,Arial,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0 0 4px}
    .sub{color:#666;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0 20px}
    th,td{border:1px solid #ccc;padding:6px 8px;text-align:left;vertical-align:top}
    th{background:#f3f4f6}
    .right{text-align:right}
    h2{font-size:14px;margin:16px 0 6px}
    @media print{@page{margin:14mm}}
  `;
  w.document.write(
    `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${title}</title><style>${style}</style></head><body>${bodyHtml}<scr` +
      `ipt>window.onload=function(){setTimeout(function(){window.print()},200)}</scr` +
      `ipt></body></html>`,
  );
  w.document.close();
}

export const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
