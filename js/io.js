import { save, normalizeRecord } from './store.js';

const CSV_HEADERS = ['id', '发生日期', '投诉类型', '问题描述', '定性', '归因维度', '留档证据', '处理结果',
  '退款金额', '赔付金额', '挽回金额', '订单号', '是否差评', '备注'];
const CSV_KEYS = ['id', 'date', 'type', 'desc', 'nature', 'cause', 'proof', 'result',
  'refund', 'comp', 'saved', 'orderId', 'review', 'note'];

function todayStamp() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJSON(records) {
  download(`badcase-backup-${todayStamp()}.json`, JSON.stringify(records, null, 2), 'application/json');
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportCSV(records) {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of records) {
    lines.push(CSV_KEYS.map((k) => csvCell(r[k])).join(','));
  }
  download(`badcase-records-${todayStamp()}.csv`, '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
}

// ---- CSV 解析（支持引号包裹、逗号、换行） ----
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], cell = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else { inQ = false; }
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r') { /* skip */ }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length > 1 || (r[0] || '').trim() !== '');
}

export function parseImportFile(filename, text) {
  if (filename.toLowerCase().endsWith('.json') || text.trim().startsWith('[')) {
    let arr;
    try { arr = JSON.parse(text); } catch { throw new Error('JSON 内容无效，请检查文件是否为本次导出的备份'); }
    if (!Array.isArray(arr)) throw new Error('JSON 应为记录数组（请使用本工具「导出JSON」产生的文件）');
    return arr.map(normalizeRecord);
  }
  if (filename.toLowerCase().endsWith('.csv') || text.includes('投诉类型')) {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('CSV 里没有数据行');
    const head = rows[0].map((h) => h.trim());
    const idx = {};
    CSV_KEYS.forEach((k, i) => { idx[k] = head.indexOf(CSV_HEADERS[i]); });
    if (idx.date === -1 || idx.nature === -1) throw new Error('CSV 表头不符合本工具导出格式');
    return rows.slice(1).map((cols) => {
      const get = (k) => (idx[k] > -1 ? cols[idx[k]] : '');
      return normalizeRecord({
        id: get('id'), date: get('date'), type: get('type'), desc: get('desc'),
        nature: get('nature'), cause: get('cause'), proof: get('proof'), result: get('result'),
        refund: get('refund'), comp: get('comp'), saved: get('saved'),
        orderId: get('orderId'), review: get('review'), note: get('note'),
      });
    });
  }
  throw new Error('不支持的文件类型，请选择本工具导出的 .json 或 .csv 文件');
}

export function replaceAll(records) {
  save(records);
}
