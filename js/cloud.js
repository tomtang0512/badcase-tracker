// 云端同步：数据以 data.json 存在 GitHub 仓库，所有人可读，配置了令牌的浏览器可写。
// 未配置令牌 = 只读模式（看到云端最新数据，改动仅存本地）。
const REPO = 'tomtang0512/badcase-tracker';
const BRANCH = 'main';
const FILE = 'data.json';
const TOKEN_KEY = 'badcase_gh_token';
const VERSION_KEY = 'badcase_cloud_version';
const PAGE_URL = 'https://tomtang0512.github.io/badcase-tracker/data.json';
const API_URL = `https://api.github.com/repos/${REPO}/contents/${FILE}`;

export function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
export function hasToken() { return !!getToken(); }
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t.trim());
  else localStorage.removeItem(TOKEN_KEY);
}

export function getVersion() { return localStorage.getItem(VERSION_KEY) || ''; }
export function setVersion(v) { if (v) localStorage.setItem(VERSION_KEY, v); }

// 拉取云端数据；返回 { updatedAt: string, records: [] } 或 null（尚未有云端数据）
export async function pull() {
  const r = await fetch(`${PAGE_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`云端数据请求失败(${r.status})`);
  const data = await r.json();
  if (!data || !Array.isArray(data.records)) return null;
  return { updatedAt: String(data.updatedAt || ''), records: data.records };
}

function b64(str) { return btoa(unescape(encodeURIComponent(str))); }

// 推送本地数据到云端，返回云端数据的 updatedAt 元信息
export async function push(records) {
  const token = getToken();
  if (!token) throw new Error('未配置写入令牌');
  const now = new Date().toISOString();
  const body = { updatedAt: now, records };

  // 先取当前文件的 sha（不存在则为新建）
  let sha = null;
  const g = await fetch(`${API_URL}?ref=${BRANCH}&t=${Date.now()}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  if (g.ok) sha = (await g.json()).sha;
  else if (g.status !== 404) throw new Error(`云端状态检查失败(${g.status})`);

  const p = await fetch(API_URL, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'chore: sync badcase data',
      content: b64(JSON.stringify(body)),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!p.ok) {
    let msg = `推送失败(${p.status})`;
    try { msg += `：${(await p.json()).message || ''}`; } catch { /* ignore */ }
    if (p.status === 401) msg = '令牌无效或已过期，请重新配置';
    if (p.status === 409) msg = '云端有更新（可能别的设备刚写入），请刷新页面获取最新数据后再改';
    throw new Error(msg);
  }
  return now;
}
