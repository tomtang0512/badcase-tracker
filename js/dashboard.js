import { OPTIONS, TYPE_GROUPS, parseType } from './store.js';

export function fmtMoney(v) {
  const n = Number(v) || 0;
  return '¥' + n.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
}
export function fmtPct(v) {
  return ((Number(v) || 0) * 100).toFixed(1) + '%';
}

export function computeMetorics(records) {
  const n = (r) => Number(r) || 0;
  const total = records.length;
  const real = records.filter((r) => r.nature === '真实客诉').length;
  const fake = records.filter((r) => r.nature === '疑似碰瓷').length;
  const tbd = records.filter((r) => r.nature === '待定').length;
  const judged = total - tbd;
  const refund = records.reduce((s, r) => s + n(r.refund), 0);
  const comp = records.reduce((s, r) => s + n(r.comp), 0);
  const logistics = records.reduce((s, r) => s + n(r.logistics), 0);
  const saved = records.reduce((s, r) => s + n(r.saved), 0);
  const cost = refund + comp + logistics;
  const fakeRejected = records.filter((r) => r.nature === '疑似碰瓷' && r.result === '自证驳回').length;
  const noProof = records.filter((r) => r.proof === '无留档').length;
  const badReview = records.filter((r) => r.review === '是').length;
  return {
    total, real, fake, tbd, judged,
    fakePct: judged > 0 ? fake / judged : 0,
    refund, comp, logistics, cost, saved, badReview,
    unitRealCost: real > 0 ? (refund + comp + logistics) / real : 0,
    fakeRejected,
    selfProveRate: fake > 0 ? fakeRejected / fake : 0,
    fakeSaved: records.filter((r) => r.nature === '疑似碰瓷').reduce((s, r) => s + n(r.saved), 0),
    noProof,
  };
}

function kpiCard(val, label, cls = '') {
  return `<div class="kpi"><div class="k-val ${cls}">${val}</div><div class="k-label">${label}</div></div>`;
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function countBy(records, key) {
  const map = {};
  for (const r of records) {
    const v = r[key] || '（未填）';
    map[v] = (map[v] || 0) + 1;
  }
  return map;
}

function renderDist(elId, records, key, ordered) {
  const el = document.getElementById(elId);
  if (!el) return;
  const total = records.length;
  if (total === 0) { el.innerHTML = '<div class="dist-empty">暂无数据</div>'; return; }
  const map = countBy(records, key);
  const rows = [];
  for (const label of ordered) {
    if (!map[label]) continue;
    rows.push({ label, cnt: map[label] });
    delete map[label];
  }
  for (const [label, cnt] of Object.entries(map)) rows.push({ label, cnt });
  rows.sort((a, b) => b.cnt - a.cnt);
  const max = Math.max(...rows.map((r) => r.cnt), 1);
  el.innerHTML = rows.map((r) => `
    <div class="dist-row">
      <div class="d-label" title="${esc(r.label)}">${esc(r.label)}</div>
      <div class="d-track"><div class="d-fill" style="width:${(r.cnt / max) * 100}%"></div></div>
      <div class="d-num">${r.cnt} · ${((r.cnt / total) * 100).toFixed(0)}%</div>
    </div>`).join('');
}

/* ---------- 投诉类型分布：大类可展开二级 ---------- */
const expandedGroups = new Set();
let typeDistRecords = [];

function renderTypeDist(records) {
  typeDistRecords = records;
  const el = document.getElementById('dist-type');
  if (!el) return;
  const total = records.length;
  if (total === 0) { el.innerHTML = '<div class="dist-empty">暂无数据</div>'; return; }

  const groups = {};
  for (const g of TYPE_GROUPS) groups[g.group] = { cnt: 0, items: {} };
  for (const r of records) {
    const { group, item } = parseType(r.type);
    const g = group || '（未填）';
    if (!groups[g]) groups[g] = { cnt: 0, items: {} };
    groups[g].cnt += 1;
    const it = item || '（未填）';
    groups[g].items[it] = (groups[g].items[it] || 0) + 1;
  }

  const gRows = Object.entries(groups)
    .filter(([, v]) => v.cnt > 0)
    .sort((a, b) => b[1].cnt - a[1].cnt);
  const max = Math.max(...gRows.map(([, v]) => v.cnt), 1);

  const bar = (label, cnt, cls = '') => `
    <div class="dist-row ${cls}">
      <div class="d-label" title="${esc(label)}">${esc(label)}</div>
      <div class="d-track"><div class="d-fill" style="width:${(cnt / max) * 100}%"></div></div>
      <div class="d-num">${cnt} · ${((cnt / total) * 100).toFixed(0)}%</div>
    </div>`;

  el.innerHTML = gRows.map(([g, v]) => {
    const expanded = expandedGroups.has(g);
    const head = `
      <div class="dist-row group ${expanded ? 'open' : ''}" data-group="${esc(g)}">
        <div class="d-label" title="${esc(g)}"><span class="d-caret">${expanded ? '▾' : '▸'}</span> ${esc(g)}</div>
        <div class="d-track"><div class="d-fill" style="width:${(v.cnt / max) * 100}%"></div></div>
        <div class="d-num">${v.cnt} · ${((v.cnt / total) * 100).toFixed(0)}%</div>
      </div>`;
    if (!expanded) return head;
    const subs = Object.entries(v.items).sort((a, b) => b[1] - a[1]);
    return head + subs.map(([it, cnt]) => bar(it, cnt, 'sub')).join('');
  }).join('');

  el.querySelectorAll('.dist-row.group').forEach((row) => {
    row.addEventListener('click', () => {
      const g = row.dataset.group;
      if (expandedGroups.has(g)) expandedGroups.delete(g);
      else expandedGroups.add(g);
      renderTypeDist(typeDistRecords);
    });
  });
}

function monthKey(date) {
  return (date || '').slice(0, 7);
}

function renderMonthly(records) {
  const n = (r) => Number(r) || 0;
  const map = {};
  for (const r of records) {
    const k = monthKey(r.date);
    if (!/^\d{4}-\d{2}$/.test(k)) continue;
    if (!map[k]) map[k] = { cnt: 0, cost: 0, saved: 0 };
    map[k].cnt += 1;
    map[k].cost += n(r.refund) + n(r.comp) + n(r.logistics);
    map[k].saved += n(r.saved);
  }
  const keys = Object.keys(map).sort().slice(-12);
  const chart = document.getElementById('month-chart');
  const max = Math.max(...keys.map((k) => map[k].cnt), 1);
  chart.style.height = keys.length ? '' : 'auto';
  chart.innerHTML = keys.map((k) => `
    <div class="month-col" title="${k}：${map[k].cnt}单，退款+赔付 ${map[k].cost.toFixed(1)}元，挽回 ${map[k].saved.toFixed(1)}元">
      <div class="m-val">${map[k].cnt}</div>
      <div class="m-bar" style="height:${Math.max((map[k].cnt / max) * 100, 3)}%"></div>
      <div class="m-label">${k.slice(2)}</div>
    </div>`).join('') || '<div class="dist-empty">暂无数据</div>';
  const tbody = document.getElementById('month-table').querySelector('tbody');
  tbody.innerHTML = keys.slice().reverse().map((k) => `
    <tr><td>${k}</td><td>${map[k].cnt}</td>
    <td class="num">${map[k].cost.toFixed(1)}</td>
    <td class="num">${map[k].saved.toFixed(1)}</td></tr>`).join('');
}

export function renderDashboard(records) {
  const m = computeMetorics(records);
  const core = [
    [m.total, '总 bad case 数（单）'],
    [m.real, '真实客诉数'],
    [m.fake, '疑似碰瓷数'],
    [m.tbd, '待定数'],
    [fmtPct(m.fakePct), '疑似碰瓷占比（占已定性）', 'pct'],
    [fmtMoney(m.refund), '退款总额', 'money'],
    [fmtMoney(m.comp), '赔付总额', 'money'],
    [fmtMoney(m.logistics), '物流费用总额', 'money'],
    [fmtMoney(m.cost), '售后总成本（退款+赔付+物流）', 'money'],
    [fmtMoney(m.unitRealCost), '单真实客诉成本', 'money'],
    [fmtMoney(m.saved), '自证挽回金额', 'money good'],
    [m.badReview, '产生差评数'],
  ];
  document.getElementById('kpi-grid').innerHTML =
    kpiCard(...core[0]) + kpiCard(...core[1]) + kpiCard(...core[2]) + kpiCard(...core[3]) +
    kpiCard(...core[4]) + kpiCard(...core[5]) + kpiCard(...core[6]) + kpiCard(...core[7]) +
    kpiCard(...core[8]) + kpiCard(...core[9]);

  const anti = [
    [m.fake, '疑似碰瓷单数'],
    [m.fakeRejected, '自证驳回单数'],
    [fmtPct(m.selfProveRate), '自证成功率', 'pct'],
    [fmtMoney(m.fakeSaved), '避免损失金额', 'money good'],
    [m.noProof, '无留档证据的客诉数'],
  ];
  document.getElementById('kpi-anti').innerHTML = anti.map((a) => kpiCard(...a)).join('');

  renderMonthly(records);
  renderTypeDist(records);
  renderDist('dist-cause', records, 'cause', OPTIONS.cause);
  renderDist('dist-result', records, 'result', OPTIONS.result);
}
