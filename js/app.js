import { list, save, add, getById, replace, remove, makeId, normalizeRecord, OPTIONS, TYPE_GROUPS, fullType, parseType, DEMO_DATA } from './store.js';
import { renderDashboard } from './dashboard.js';
import { renderRecords, esc, bindHeaderFilters } from './records.js';
import { exportJSON, exportCSV, parseImportFile, replaceAll } from './io.js';

// ---------- 工具 ----------
const $ = (sel) => document.querySelector(sel);
let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

function refreshAll() {
  renderDashboard(list());
  renderRecords(list());
}

// ---------- Tab 切换 ----------
$('#tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t === btn));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  $(`#view-${btn.dataset.tab}`).classList.add('active');
});

// ---------- 下拉选项初始化 ----------
function fillSelect(select, items, emptyLabel) {
  select.innerHTML = (emptyLabel !== undefined ? `<option value="">${emptyLabel}</option>` : '') +
    items.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
}
document.querySelectorAll('[data-options]').forEach((sel) => {
  fillSelect(sel, OPTIONS[sel.dataset.options], sel.dataset.options === 'cause' || sel.dataset.options === 'proof' || sel.dataset.options === 'result' ? '' : undefined);
});
fillSelect($('#filter-nature'), OPTIONS.nature, '全部定性');

// ---------- 筛选栏：大类 → 具体项目 级联 ----------
const fGroupSel = $('#filter-group');
const fTypeSel = $('#filter-type');
fillSelect(fGroupSel, TYPE_GROUPS.map((g) => g.group), '全部大类');
fGroupSel.addEventListener('change', () => {
  const g = TYPE_GROUPS.find((x) => x.group === fGroupSel.value);
  if (!g) {
    fillSelect(fTypeSel, [], '先选大类');
    fTypeSel.disabled = true;
  } else {
    fTypeSel.innerHTML = '<option value="">全部项目</option>' +
      g.items.map((it) => { const ft = fullType(g.group, it); return `<option value="${esc(ft)}">${esc(it)}</option>`; }).join('');
    fTypeSel.disabled = false;
  }
  renderRecords(list());
});
fTypeSel.addEventListener('change', () => renderRecords(list()));

// ---------- 表单：大类 → 具体类型 级联 ----------
const groupSel = $('#type-group');
const itemSel = $('#type-item');
fillSelect(groupSel, TYPE_GROUPS.map((g) => g.group), '请选择大类');
groupSel.addEventListener('change', () => {
  const g = TYPE_GROUPS.find((x) => x.group === groupSel.value);
  if (!g) {
    itemSel.innerHTML = '<option value="">先选大类</option>';
    itemSel.disabled = true;
    return;
  }
  fillSelect(itemSel, g.items, '请选择');
  itemSel.disabled = false;
});

function setType(group, item) {
  groupSel.value = group || '';
  if (group) {
    const g = TYPE_GROUPS.find((x) => x.group === group);
    fillSelect(itemSel, g ? g.items : [], '请选择');
    itemSel.disabled = !g;
    itemSel.value = item || '';
    if (item && itemSel.value !== item) itemSel.value = '';
  } else {
    itemSel.innerHTML = '<option value="">先选大类</option>';
    itemSel.disabled = true;
  }
}

// ---------- 弹窗：新增 / 编辑 ----------
const modal = $('#modal-mask');
const form = $('#record-form');
let editingId = null;

function openModal(rec) {
  editingId = rec ? rec.id : null;
  $('#modal-title').textContent = rec ? '编辑 Bad Case 记录' : '新增 Bad Case 记录';
  const pt = rec ? parseType(rec.type) : { group: '', item: '' };
  setType(pt.group, pt.item);
  for (const el of form.elements) {
    if (!el.name || el.name === 'typeGroup' || el.name === 'typeItem') continue;
    if (el.name === 'review' && !rec) el.value = '否';
    else el.value = rec ? (rec[el.name] ?? '') : (el.defaultValue !== undefined && el.type === 'number' ? '0' : '');
  }
  modal.hidden = false;
  form.elements.date.focus();
}
function closeModal() { modal.hidden = true; form.reset(); editingId = null; }

$('#btn-add').addEventListener('click', () => openModal(null));
$('#btn-cancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = { id: editingId || makeId() };
  for (const el of form.elements) {
    if (!el.name || el.name === 'typeGroup' || el.name === 'typeItem') continue;
    data[el.name] = el.type === 'number' ? (parseFloat(el.value) || 0) : el.value.trim();
  }
  data.type = fullType(groupSel.value, itemSel.value);
  if (!data.date || !data.type || !data.nature) { toast('请填写日期、问题大类与具体类型、定性'); return; }
  const rec = normalizeRecord(data);
  if (editingId) replace(editingId, rec);
  else add(rec);
  closeModal();
  refreshAll();
  toast(editingId ? '已更新' : '已保存');
});

// ---------- 明细表操作（编辑/删除） ----------
$('#records-body').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) return;
  const id = tr.dataset.id;
  if (e.target.classList.contains('act-edit')) {
    const rec = getById(id);
    if (rec) openModal(rec);
  } else if (e.target.classList.contains('act-del')) {
    if (confirm('确定删除这条记录吗？删除后不可恢复。')) {
      remove(id);
      refreshAll();
      toast('已删除');
    }
  }
});

// ---------- 筛选 ----------
$('#filter-nature').addEventListener('change', () => renderRecords(list()));
$('#filter-text').addEventListener('input', () => renderRecords(list()));
bindHeaderFilters(list, () => renderRecords(list()));

// ---------- 数据菜单 ----------
$('#btn-export-json').addEventListener('click', () => { exportJSON(list()); toast('已导出 JSON 备份'); });
$('#btn-export-csv').addEventListener('click', () => { exportCSV(list()); toast('已导出 CSV'); });

const fileInput = $('#file-input');
$('#btn-import').addEventListener('click', () => { fileInput.value = ''; fileInput.click(); });
fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = parseImportFile(file.name, reader.result);
      if (incoming.length === 0) { toast('文件里没有记录'); return; }
      const existing = list().length;
      const ok = confirm(`将导入 ${incoming.length} 条记录，并覆盖当前数据（当前 ${existing} 条）。覆盖前建议先「导出JSON」备份。确定继续吗？`);
      if (!ok) return;
      replaceAll(incoming);
      refreshAll();
      toast(`已导入 ${incoming.length} 条记录`);
    } catch (err) {
      alert('导入失败：' + (err.message || err));
    }
  };
  reader.readAsText(file, 'utf-8');
});

$('#btn-demo').addEventListener('click', () => {
  const existing = list();
  if (existing.length === 0 || confirm('将覆盖当前数据并载入 3 条示例记录，确定吗？')) {
    save(DEMO_DATA.map(normalizeRecord));
    refreshAll();
    toast('已载入示例数据');
  }
});

$('#btn-clear').addEventListener('click', () => {
  const n = list().length;
  if (n === 0) { toast('当前没有数据'); return; }
  if (confirm(`将删除全部 ${n} 条记录且不可恢复，确定吗？（建议先导出JSON备份）`)) {
    save([]);
    refreshAll();
    toast('已清空');
  }
});

// ---------- 初始化 ----------
refreshAll();
