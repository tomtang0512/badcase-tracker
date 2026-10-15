import { OPTIONS, parseType } from './store.js';

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function getFilters() {
  return {
    nature: document.getElementById('filter-nature').value,
    group: document.getElementById('filter-group').value,
    type: document.getElementById('filter-type').value,
    text: document.getElementById('filter-text').value.trim().toLowerCase(),
  };
}

// 表头列筛选状态：key -> Set(选中值)，空/无 = 不过滤
const colFilters = {};
let allRecordsCache = [];

const NA = '（未填）';

// 每列取值函数：决定该列筛选依据
export const COL_VALUE = {
  date: (r) => String(r.date || '').slice(0, 7), // 按月聚合，避免日期值太多
  channel: (r) => r.channel || NA,
  type: (r) => parseType(r.type).group, // 类型列按大类筛
  nature: (r) => r.nature || NA,
  cause: (r) => r.cause || NA,
  proof: (r) => r.proof || NA,
  result: (r) => r.result || NA,
  review: (r) => r.review === '是' ? '是' : '否',
};

export function colFilterActive(r) {
  for (const [key, set] of Object.entries(colFilters)) {
    if (!set || !set.size) continue;
    const fn = COL_VALUE[key];
    if (!fn) continue;
    if (!set.has(fn(r))) return false;
  }
  return true;
}

export function filterRecords(records, f) {
  return records.filter((r) => {
    if (f.nature && r.nature !== f.nature) return false;
    if (f.type && r.type !== f.type) return false;
    if (!f.type && f.group && parseType(r.type).group !== f.group) return false;
    if (f.text) {
      const hay = `${r.desc} ${r.orderId} ${r.note} ${r.type}`.toLowerCase();
      if (!hay.includes(f.text)) return false;
    }
    if (!colFilterActive(r)) return false;
    return true;
  });
}

/* ---------- 表头筛选面板 ---------- */

let panelEl = null;
let panelCol = null;

function ensurePanel() {
  if (panelEl) return panelEl;
  panelEl = document.createElement('div');
  panelEl.className = 'filter-panel';
  panelEl.hidden = true;
  document.body.appendChild(panelEl);
  document.addEventListener('click', (e) => {
    if (panelEl && !panelEl.hidden && !panelEl.contains(e.target) && !(e.target.closest && e.target.closest('th[data-fcol]'))) {
      closePanel();
    }
  });
  return panelEl;
}

function closePanel() {
  if (panelEl) panelEl.hidden = true;
  panelCol = null;
}

function openPanel(th, key) {
  const panel = ensurePanel();
  panelCol = key;
  const valueFn = COL_VALUE[key];
  const counts = new Map();
  for (const r of allRecordsCache) {
    const v = valueFn(r);
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const values = [...counts.keys()].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
  const cur = colFilters[key] || new Set();
  panel.innerHTML = `
    <div class="fp-head">筛选：${esc(th.textContent.replace('▾', '').trim())}</div>
    <div class="fp-list">
      ${values.map((v) => `
        <label class="fp-item">
          <input type="checkbox" value="${esc(v)}" ${cur.size === 0 || cur.has(v) ? 'checked' : ''} />
          <span>${esc(v)}</span><em>${counts.get(v)}</em>
        </label>`).join('') || '<div class="fp-empty">暂无数据</div>'}
    </div>
    <div class="fp-foot">
      <button type="button" class="btn link" data-act="clear">清除本列筛选</button>
      <button type="button" class="btn link primary" data-act="close">收起</button>
    </div>`;
  panel.hidden = false;
  // 定位到列头下方
  const rect = th.getBoundingClientRect();
  panel.style.top = `${rect.bottom + window.scrollY + 4}px`;
  panel.style.left = `${Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - panel.offsetWidth - 12)}px`;

  panel.querySelectorAll('input[type=checkbox]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const checked = [...panel.querySelectorAll('input[type=checkbox]:checked')].map((c) => c.value);
      if (checked.length === values.length) {
        delete colFilters[key]; // 全选 = 不过滤
      } else {
        colFilters[key] = new Set(checked);
      }
      decorateHeaders();
      rerenderRecords();
    });
  });
  panel.querySelector('[data-act=clear]').addEventListener('click', () => {
    delete colFilters[key];
    decorateHeaders();
    closePanel();
    rerenderRecords();
  });
  panel.querySelector('[data-act=close]').addEventListener('click', closePanel);
}

export function decorateHeaders() {
  document.querySelectorAll('th[data-fcol]').forEach((th) => {
    const key = th.dataset.fcol;
    th.classList.toggle('f-active', !!(colFilters[key] && colFilters[key].size));
  });
}

export function bindHeaderFilters(recordsGetter, rerender) {
  rerenderRecords = rerender;
  const thead = document.querySelector('.records-table thead');
  thead.addEventListener('click', (e) => {
    const th = e.target.closest('th[data-fcol]');
    if (!th) return;
    allRecordsCache = recordsGetter();
    const key = th.dataset.fcol;
    if (panelCol === key && panelEl && !panelEl.hidden) {
      closePanel();
    } else {
      openPanel(th, key);
    }
  });
}

let rerenderRecords = () => {};

function natureTag(nature) {
  const cls = nature === '真实客诉' ? 'real' : nature === '疑似碰瓷' ? 'fake' : 'tbd';
  return `<span class="tag ${cls}">${esc(nature || '未填')}</span>`;
}

function money(v, highlight) {
  const n = Number(v) || 0;
  if (n === 0) return '<span class="money-zero">-</span>';
  return highlight ? `<span class="money-pos">${n.toFixed(1)}</span>` : n.toFixed(1);
}

function recRow(r) {
  return `<tr data-id="${esc(r.id)}">
    <td>${esc(r.date)}</td>
    <td>${esc(r.channel || '-')}</td>
    <td>${esc(r.type)}</td>
    <td>${natureTag(r.nature)}</td>
    <td>${esc(r.cause || '-')}</td>
    <td>${esc(r.proof || '-')}${r.photos && r.photos.length ? ` <button type="button" class="btn link act-photo" title="查看照片">📷${r.photos.length}</button>` : ''}</td>
    <td>${esc(r.result || '-')}</td>
    <td class="num">${money(r.refund, true)}</td>
    <td class="num">${money(r.comp, true)}</td>
    <td class="num">${money(r.logistics, true)}</td>
    <td class="num">${money(r.saved, false)}</td>
    <td>${r.review === '是' ? '<span class="tag review">差评</span>' : '-'}</td>
    <td>
      <button class="btn link act-edit">编辑</button>
      <button class="btn link danger act-del">删除</button>
    </td>
  </tr>`;
}

export function renderRecords(records) {
  const f = getFilters();
  const shown = filterRecords(records, f);
  const tbody = document.getElementById('records-body');
  tbody.innerHTML = shown
    .slice()
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .map(recRow)
    .join('');
  document.getElementById('empty-hint').hidden = records.length !== 0;
  const suffix = shown.length === records.length ? `（共 ${records.length} 条）` : `（${shown.length}/${records.length} 条）`;
  document.getElementById('rec-count').textContent = suffix;
}
