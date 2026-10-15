const KEY = 'badcase_records_v1';

export const TYPE_GROUPS = [
  { group: '异物', items: ['毛发', '虫类', '塑料/纸片', '金属/硬物', '其他'] },
  { group: '品质', items: ['变质/异味', '不新鲜/色泽差', '化冻/回温', '缺斤少两', '临期/过期', '标签错误', '分量不足', '口味/口感异常'] },
  { group: '包装', items: ['破损/漏液', '封口不严'] },
  { group: '错漏装', items: ['漏餐具', '漏酱料/水果', '漏碗/漏餐', '送错/漏发'] },
  { group: '配送', items: ['延迟致变质', '超时变冷', '发货过早/取餐难', '定位偏差', '状态不同步', '倾洒/污染'] },
  { group: '其他', items: ['其他'] },
];

export const OPTIONS = {
  type: TYPE_GROUPS.flatMap((g) => (g.group === '其他' ? g.items : g.items.map((i) => `${g.group}-${i}`))),
  nature: ['真实客诉', '疑似碰瓷', '待定'],
  cause: ['人', '物料', '环境', '操作', '物料上游', '其他', '待归因'],
  proof: ['品牌封口贴照片', '监控视频', '商品照片/视频', '多项留档', '无留档'],
  result: ['仅退款', '退款+赔付', '换货/补发', '协商部分退款', '自证驳回', '待处理'],
  review: ['否', '是'],
  channel: ['小红书', '健身房', '域内'],
};

export function list() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function save(records) {
  localStorage.setItem(KEY, JSON.stringify(records));
}

export function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// 大类+具体类型 <-> 完整类型字符串（存储格式不变，如 "品质-分量不足"；"其他"大类无前缀）
export function fullType(group, item) {
  if (!group || !item) return '';
  return group === '其他' ? '其他' : `${group}-${item}`;
}

export function parseType(t) {
  const s = String(t || '').trim();
  if (!s) return { group: '', item: '' };
  const i = s.indexOf('-');
  if (i < 0) return { group: '其他', item: s };
  return { group: s.slice(0, i), item: s.slice(i + 1) };
}

export function add(rec) {
  const rs = list();
  rs.push(rec);
  save(rs);
}

export function getById(id) {
  return list().find((r) => r.id === id) || null;
}

export function replace(id, rec) {
  const rs = list();
  const i = rs.findIndex((r) => r.id === id);
  if (i > -1) { rs[i] = rec; save(rs); }
}

export function remove(id) {
  save(list().filter((r) => r.id !== id));
}

export function normalizeRecord(raw) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0; };
  const pick = (v, key) => (OPTIONS[key].includes(v) ? v : '');
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : makeId(),
    date: String(raw.date || ''),
    type: raw.type || '',
    desc: String(raw.desc || ''),
    nature: raw.nature || '',
    cause: raw.cause || '',
    proof: pick(raw.proof, 'proof') || raw.proof || '',
    result: pick(raw.result, 'result') || raw.result || '',
    refund: num(raw.refund),
    comp: num(raw.comp),
    saved: num(raw.saved),
    orderId: String(raw.orderId || ''),
    channel: pick(raw.channel, 'channel') || raw.channel || '',
    photos: Array.isArray(raw.photos)
      ? raw.photos.filter((p) => typeof p === 'string' && p.startsWith('data:image/')).slice(0, 9)
      : [],
    review: raw.review === '是' ? '是' : '否',
    note: String(raw.note || ''),
    updatedAt: new Date().toISOString(),
  };
}

export const DEMO_DATA = [
  {
    id: 'demo1', date: '2026-09-08', type: '异物-毛发', channel: '域内',
    desc: '用户反馈卤鸡腿内有毛发（示例数据，正式使用前可清空）',
    nature: '真实客诉', cause: '人', proof: '品牌封口贴照片', result: '仅退款',
    refund: 28.9, comp: 0, saved: 0, orderId: '20260908#1', review: '否',
    note: '已道歉并退款，全员重申帽子手套规范',
  },
  {
    id: 'demo2', date: '2026-09-12', type: '异物-塑料/纸片', channel: '小红书',
    desc: '用户称袋内有塑料片，但封口贴完好、与出货照片不符（示例数据）',
    nature: '疑似碰瓷', cause: '待归因', proof: '多项留档', result: '自证驳回',
    refund: 0, comp: 0, saved: 45, orderId: '20260912#1', review: '否',
    note: '出示封口贴+出货照片后用户撤诉',
  },
  {
    id: 'demo3', date: '2026-09-15', type: '品质-变质/异味', channel: '健身房',
    desc: '冷链配送延迟导致鲜奶变质（示例数据）',
    nature: '真实客诉', cause: '操作', proof: '商品照片/视频', result: '退款+赔付',
    refund: 39.9, comp: 100, saved: 0, orderId: '20260915#2', review: '是',
    note: '全额退款+100红包，追查该时段配送',
  },
];
