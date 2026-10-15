// 无畏契约准星抓取脚本
// 数据源：
//   1. estnn.com —— 职业选手准星（队伍 + 选手 ID + 代码）
//   2. vcrdb.net —— 社区准星（名字 + 代码，含热门详情页）
// 输出：data/crosshairs.json（合并原有精选数据）
const https = require('https');
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fetchText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('too many redirects: ' + url));
    const req = https.get(url, { headers: { 'User-Agent': UA, 'Accept': 'text/html,*/*' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(fetchText(new URL(res.headers.location, url).toString(), redirects + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' for ' + url)); }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "'").replace(/&#8220;|&ldquo;/g, '"').replace(/&#8221;|&rdquo;/g, '"')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// 战队名（含常见缩写）
const TEAMS = [
  'Sentinels', 'NRG', 'Evil Geniuses', 'Cloud9', '100 Thieves', 'LOUD', 'Fnatic',
  'Team Liquid', 'Team Vitality', 'Paper Rex', 'DRX', 'Gen.G', 'T1', 'Talon', 'EDG',
  'FPX', 'ZETA DIVISION', 'DetonatioN', 'Global Esports', 'FUT Esports', 'BBL',
  'Karmine Corp', 'Heretics', 'G2 Esports', 'Natus Vincere', 'Leviat', 'MIBR', 'Furia',
  'KR', 'OpTic', 'XSET', 'MAD Lions', 'KOI', 'Giants', 'Guild', 'Bleed', 'Trace',
  'Wolves', 'TEC', 'AG', 'TYLOO', 'Nova', 'BLG', 'JDG', 'Bilibili', 'Rare Atom',
  'Team Secret', 'FENNEL', 'Crest Gaming', 'SCARZ', 'Gen.G Esports',
  // 缩写
  'SEN', 'EG', 'C9', '100T', 'FNC', 'TL', 'PRX', 'LEV', 'KRU', 'FUR', 'MIBR', 'G2',
  'KC', 'NAVI', 'TH', 'GEN', 'DFM', 'GE', 'FUT', 'BBL', 'XSET', 'M80', 'OXY', 'LOUD'
];

function matchTeam(line) {
  for (const t of TEAMS) {
    if (line === t || line.startsWith(t + ' ')) return t;
  }
  return ''; // 不匹配则视为无队伍（自由选手/主播）
}

// 精选社区准星（始终保留，中文名，排在最前）
const CURATED_COMMUNITY = [
  { id: 'default', name: '默认准星', tags: ['基础', '经典'], code: '0;P' },
  { id: 'dot', name: '纯点准星', tags: ['点', '精确'], code: '0;P;c;5;o;1;d;1;0b;0;1b;0' },
  { id: 'circle', name: '圆形准星', tags: ['圆形', '经典'], code: '0;s;1;P;c;5;h;0;0t;4;0l;1;0o;2;0a;1;0f;0;1b;0' },
  { id: 'circle-outline', name: '圆形准星（带外圈）', tags: ['圆形', '外圈'], code: '0;P;c;5;h;0;0t;4;0l;1;0o;2;0a;1;0f;0;1b;1;1t;6;1l;1;1o;3;1a;0.5;1m;0;1f;0' },
  { id: 'thin-cross', name: '细十字', tags: ['十字', '竞技'], code: '0;P;c;1;h;0;0t;1;0l;4;0o;1;0a;1;0f;0;1b;0' },
  { id: 'small-cross', name: '小十字', tags: ['十字', '紧凑'], code: '0;P;c;7;h;0;0t;2;0l;3;0o;1;0a;1;0f;0;1b;0' }
];

// 已知中文名（用于补充选手中文名）
const CN_NAMES = { 'ZmjjKK': '郑永康' };

// ---- 数据源 1：estnn 职业选手 ----
function parseEstnn(html) {
  const text = decodeEntities(
    html
      .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
      .replace(/<br\s*\/?\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const pros = [];
  const codeRe = /0;[0-9a-zA-Z.;]+/g;
  const seen = new Set();

  for (const line of lines) {
    const codes = line.match(codeRe);
    if (!codes) continue;
    const code = codes[codes.length - 1];
    const head = line.slice(0, line.lastIndexOf(code)).trim();
    if (!head) continue;

    const tagMatch = head.match(/"([^"]+)"/);
    let name = '';
    if (tagMatch) name = tagMatch[1].trim();
    else name = head.split(/\s+/).pop() || '';
    name = name.replace(/["“”]/g, '').replace(/[’']/g, "'").trim();
    if (!name || name.length > 30 || !/^[A-Za-z0-9'’.\- ]+$/.test(name)) continue;

    const team = matchTeam(head.replace(/"([^"]+)"/, ' ').trim());
    const key = slug(name);
    if (seen.has(key)) continue;
    seen.add(key);

    pros.push({ id: key, name: name, team: team || undefined, code: code });
  }
  return pros;
}

// ---- 数据源 2：vcrdb 社区准星 ----
function parseVcrdbHome(html) {
  // 最近提交：名字 + id + 代码（RSC 载荷）
  const unescaped = html.replace(/\\"/g, '"');
  const codeMap = {};
  const idCodeRe = /"id":(\d+),"code":"([^"]+)"/g;
  let m;
  while ((m = idCodeRe.exec(unescaped)) !== null) codeMap[m[1]] = m[2];

  const list = [];
  const recentRe = /<a class="recentlyCard"[^>]*href="\/crosshair\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;
  while ((m = recentRe.exec(html)) !== null) {
    const id = m[1];
    const nameM = m[2].match(/recentlyCard-name">([^<]+)</);
    const code = codeMap[id];
    if (nameM && code) list.push({ id: 'vcrdb-' + id, name: decodeEntities(nameM[1].trim()), tags: [], code });
  }
  return list;
}

async function fetchVcrdbDetail(id) {
  const html = await fetchText('https://vcrdb.net/crosshair/' + id);
  const nameM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const codeM = html.match(/<code class="crosshair-code"[^>]*>([^<]+)<\/code>/);
  if (nameM && codeM) {
    const name = decodeEntities(nameM[1].replace(/<[^>]+>/g, '').trim());
    const code = codeM[1].trim();
    if (name && /^0;/.test(code)) return { id: 'vcrdb-' + id, name: name, tags: [], code: code };
  }
  return null;
}

function isJunkName(name) {
  return !name || name.length < 3 || !/[A-Za-z]/.test(name) || /^\d+$/.test(name);
}

(async function main() {
  const outPath = path.join(__dirname, '..', 'data', 'crosshairs.json');
  const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));

  // ---- 职业选手 ----
  let estnnPros = [];
  try {
    console.log('抓取 estnn 职业选手准星...');
    estnnPros = parseEstnn(await fetchText('https://estnn.com/all-pro-valorant-crosshair-codes/'));
    console.log('  → 职业选手:', estnnPros.length);
  } catch (e) { console.log('  estnn 失败:', e.message); }

  // ---- 社区准星 ----
  const community = [];
  const codeSeen = new Set();
  const addCommunity = (items) => {
    for (const c of items) {
      if (!c || !c.code || codeSeen.has(c.code)) continue;
      if (isJunkName(c.name)) continue;
      codeSeen.add(c.code);
      community.push(c);
    }
  };

  try {
    console.log('抓取 vcrdb 经典准星详情页（id 1..100）...');
    for (let id = 1; id <= 100; id++) {
      try {
        addCommunity([await fetchVcrdbDetail(id)]);
      } catch (e) { /* 跳过失败 */ }
      if (id % 20 === 0) { console.log('  → 已抓取 id', id, '，累计', community.length, '个'); await sleep(80); }
      await sleep(120);
    }
    console.log('  → 社区准星（总计）:', community.length);
  } catch (e) { console.log('  vcrdb 详情页失败:', e.message); }

  // ---- 合并精选数据 ----
  // 社区：精选（默认/纯点/圆形等）排最前，再并入抓取结果
  const communityById = {};
  for (const c of CURATED_COMMUNITY) communityById[c.id] = c;
  for (const c of community) if (!communityById[c.id]) communityById[c.id] = c;
  const finalCommunity = Object.values(communityById);

  // 职业：以抓取为主，补充中文名
  const finalPros = estnnPros.map((p) => {
    const cn = CN_NAMES[p.name];
    return cn ? { ...p, cn } : p;
  });

  const result = {
    updatedAt: new Date().toISOString().slice(0, 10),
    community: finalCommunity,
    pros: finalPros
  };
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log('\n完成：社区', finalCommunity.length, '个 / 职业', finalPros.length, '个 → data/crosshairs.json');
})().catch((e) => { console.error('抓取失败：', e.message); process.exit(1); });
