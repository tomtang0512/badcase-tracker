import { list, save, add, getById, replace, remove, makeId, normalizeRecord, OPTIONS, TYPE_GROUPS, fullType, parseType, DEMO_DATA } from './store.js';
import { renderDashboard } from './dashboard.js';
import { renderRecords, esc, bindHeaderFilters } from './records.js';
import { exportJSON, exportCSV, parseImportFile, replaceAll } from './io.js';
import * as cloud from './cloud.js';

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
  renderDashboard(list().filter(inRange));
  renderRecords(list());
}

// ---------- 云端同步 ----------
const syncStatus = $('#sync-status');

function setSync(text, cls) {
  syncStatus.textContent = text;
  syncStatus.className = `sync-status ${cls || ''}`;
}

function fmtHM(iso) {
  const d = new Date(iso);
  const p = (x) => String(x).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

function maxTs(rs) {
  return rs.reduce((m, r) => Math.max(m, +new Date(r.updatedAt || 0)), 0);
}

let pushTimer = null;
let pushing = false;

async function pushNow(manual) {
  if (!cloud.hasToken()) {
    if (manual) toast('请先在「同步设置」里配置写入令牌');
    else setSync('未同步：未配置令牌，改动仅存本机', 'warn');
    return;
  }
  if (pushing) { if (manual) toast('正在同步中，请稍候'); return; }
  pushing = true;
  setSync('正在上传云端…', 'busy');
  try {
    const ver = await cloud.push(list());
    cloud.setVersion(ver);
    setSync(`已同步云端 ${fmtHM(ver)}`, 'ok');
    if (manual) toast('已上传云端');
  } catch (err) {
    setSync(`同步失败：${err.message}`, 'err');
    if (manual) toast(`同步失败：${err.message}`);
  } finally {
    pushing = false;
  }
}

function schedulePush() {
  if (!cloud.hasToken()) { setSync('只读模式：改动仅存本机', 'warn'); return; }
  clearTimeout(pushTimer);
  setSync('待同步…', 'busy');
  pushTimer = setTimeout(() => pushNow(false), 1500);
}

async function bootCloud() {
  try {
    const data = await cloud.pull();
    if (!data) {
      setSync(cloud.hasToken() ? '云端暂无数据，改动后自动上传' : '云端暂无数据（只读）', 'warn');
      if (cloud.hasToken() && list().length) schedulePush();
      return;
    }
    const local = list();
    const cloudMax = maxTs(data.records);
    const localMax = maxTs(local);
    // 版本不一致时采纳云端，但本地有未同步的更新时优先本地
    const adoptEmpty = data.records.length === 0 && cloud.getVersion() && cloud.getVersion() !== data.updatedAt;
    if (cloud.getVersion() !== data.updatedAt && (local.length === 0 || cloudMax >= localMax || adoptEmpty)) {
      save(data.records);
      cloud.setVersion(data.updatedAt);
      refreshAll();
    }
    if (cloud.hasToken() && localMax > cloudMax && local.length > 0) {
      // 本地比云端新（离线改动），补推
      setSync('本地有未同步更新，正在上传…', 'busy');
      pushNow(false);
    } else {
      setSync(`已同步云端 ${fmtHM(data.updatedAt)}`, 'ok');
    }
  } catch {
    setSync('云端读取失败，当前展示本机数据', 'err');
  }
}

$('#btn-token').addEventListener('click', () => {
  const cur = cloud.getToken();
  const hint = cur ? '已有令牌，重新输入可替换，留空并确定则清除' : '粘贴 GitHub 访问令牌（建议细粒度令牌：仅本仓库、Contents 读写权限）';
  const t = prompt(`${hint}：`, cur);
  if (t === null) return;
  cloud.setToken(t.trim());
  if (cloud.hasToken()) { toast('令牌已保存，开始同步'); schedulePush(); }
  else { toast('令牌已清除'); setSync('只读模式', 'warn'); }
});

$('#btn-sync-now').addEventListener('click', () => pushNow(true));

// ---------- 看板日期筛选 ----------
const rangePreset = $('#range-preset');
const rangeStart = $('#range-start');
const rangeEnd = $('#range-end');

function fmtDate(d) {
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function applyPreset() {
  const v = rangePreset.value;
  const custom = v === 'custom';
  rangeStart.disabled = !custom;
  rangeEnd.disabled = !custom;
  rangeStart.value = '';
  rangeEnd.value = '';
  if (custom || v === 'all') return;
  const now = new Date();
  if (v === 'month') {
    rangeStart.value = fmtDate(new Date(now.getFullYear(), now.getMonth(), 1));
  } else if (v === 'd30') {
    const d = new Date(now); d.setDate(d.getDate() - 29); rangeStart.value = fmtDate(d);
  } else if (v === 'd90') {
    const d = new Date(now); d.setDate(d.getDate() - 89); rangeStart.value = fmtDate(d);
  }
  rangeEnd.value = fmtDate(now);
}

function inRange(r) {
  const s = rangeStart.value, e = rangeEnd.value;
  if (s && String(r.date) < s) return false;
  if (e && String(r.date) > e) return false;
  return true;
}

rangePreset.addEventListener('change', () => { applyPreset(); refreshAll(); });
[rangeStart, rangeEnd].forEach((i) => i.addEventListener('change', () => refreshAll()));

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
  const noEmpty = sel.dataset.options === 'nature' || sel.dataset.options === 'review';
  fillSelect(sel, OPTIONS[sel.dataset.options], noEmpty ? undefined : '');
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
  pendingPhotos = rec && Array.isArray(rec.photos) ? [...rec.photos] : [];
  renderPhotoPreviews();
  for (const el of form.elements) {
    if (!el.name || el.name === 'typeGroup' || el.name === 'typeItem' || el.type === 'file') continue;
    if (el.name === 'review' && !rec) el.value = '否';
    else el.value = rec ? (rec[el.name] ?? '') : (el.defaultValue !== undefined && el.type === 'number' ? '0' : '');
  }
  modal.hidden = false;
  form.elements.date.focus();
}
function closeModal() { modal.hidden = true; form.reset(); editingId = null; pendingPhotos = []; renderPhotoPreviews(); }

// ---------- 照片：选择/压缩/预览 ----------
let pendingPhotos = [];
const photoInput = form.elements.photos;
const previewBox = $('#photo-previews');

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1280;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (Math.max(w, h) > MAX) { const k = MAX / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败')); };
    img.src = url;
  });
}

function renderPhotoPreviews() {
  previewBox.innerHTML = pendingPhotos.map((p, i) => `
    <span class="photo-thumb">
      <img src="${p}" alt="照片${i + 1}" data-i="${i}" />
      <button type="button" class="thumb-del" data-del="${i}" title="移除">×</button>
    </span>`).join('');
}
photoInput.addEventListener('change', async () => {
  const files = [...photoInput.files].slice(0, 9 - pendingPhotos.length);
  if (files.length === 0) { toast('每单最多 9 张照片'); photoInput.value = ''; return; }
  for (const f of files) {
    try { pendingPhotos.push(await compressImage(f)); }
    catch { toast('有一张照片读取失败，已跳过'); }
  }
  photoInput.value = '';
  renderPhotoPreviews();
});
previewBox.addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  if (del) { pendingPhotos.splice(Number(del.dataset.del), 1); renderPhotoPreviews(); }
  const img = e.target.closest('img[data-i]');
  if (img) openLightbox([pendingPhotos[Number(img.dataset.i)]]);
});

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
  data.photos = pendingPhotos;
  if (!data.date || !data.type || !data.nature) { toast('请填写日期、问题大类与具体类型、定性'); return; }
  // 订单编号留空时自动生成：日期#当天第几单
  if (!data.orderId) {
    const d = data.date.replace(/-/g, '');
    const prefix = `${d}#`;
    const n = list().filter((r) => String(r.orderId || '').startsWith(prefix)).length + 1;
    data.orderId = `${prefix}${n}`;
  }
  const rec = normalizeRecord(data);
  try {
    if (editingId) replace(editingId, rec);
    else add(rec);
  } catch {
    toast('保存失败：照片太多，超出浏览器存储上限，请删减照片后重试');
    return;
  }
  closeModal();
  refreshAll();
  schedulePush();
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
  } else if (e.target.classList.contains('act-photo')) {
    const rec = getById(id);
    if (rec && rec.photos && rec.photos.length) openLightbox(rec.photos);
  } else if (e.target.classList.contains('act-del')) {
    if (confirm('确定删除这条记录吗？删除后不可恢复。')) {
      remove(id);
      refreshAll();
      schedulePush();
      toast('已删除');
    }
  }
});

// ---------- 照片查看器 ----------
const lightbox = $('#lightbox');
const lightboxBody = $('#lightbox-body');
function openLightbox(photos) {
  lightboxBody.innerHTML = photos.map((p) => `<img src="${p}" alt="照片" />`).join('');
  lightbox.hidden = false;
}
lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target === lightboxBody) lightbox.hidden = true; });

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
      schedulePush();
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
    schedulePush();
    toast('已载入示例数据');
  }
});

$('#btn-clear').addEventListener('click', () => {
  const n = list().length;
  if (n === 0) { toast('当前没有数据'); return; }
  if (confirm(`将删除全部 ${n} 条记录且不可恢复，确定吗？（建议先导出JSON备份）`)) {
    save([]);
    refreshAll();
    schedulePush();
    toast('已清空');
  }
});

// ---------- 初始化 ----------
refreshAll();
bootCloud();
