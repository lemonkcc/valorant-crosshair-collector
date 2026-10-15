(function () {
  'use strict';

  let data = { community: [], pros: [] };

  const tabButtons = document.querySelectorAll('.tab-btn');
  const communityGrid = document.getElementById('community-grid');
  const prosGrid = document.getElementById('pros-grid');
  const searchInput = document.getElementById('search');
  const rendered = []; // 已绘制的画布，用于窗口缩放时重绘

  function normalize(s) {
    return (s || '').toLowerCase();
  }

  function makeCard(item) {
    const card = document.createElement('article');
    card.className = 'card';

    // 预览区
    const preview = document.createElement('div');
    preview.className = 'preview';
    const canvas = document.createElement('canvas');
    preview.appendChild(canvas);

    // 信息区（名字/ID 显示在准星下方）
    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = item.name;
    const sub = document.createElement('div');
    sub.className = 'sub';
    const subParts = [];
    if (item.team) subParts.push(item.team);
    if (item.cn) subParts.push(item.cn);
    if (item.tags && item.tags.length) subParts.push(item.tags.join(' · '));
    sub.textContent = subParts.join(' · ');
    info.appendChild(name);
    info.appendChild(sub);

    // 复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = '复制代码';
    copyBtn.addEventListener('click', function () {
      try {
        if (window.api && window.api.copyText) {
          window.api.copyText(item.code);
        } else {
          navigator.clipboard.writeText(item.code);
        }
        copyBtn.textContent = '已复制 ✓';
        copyBtn.classList.add('copied');
        setTimeout(function () {
          copyBtn.textContent = '复制代码';
          copyBtn.classList.remove('copied');
        }, 1500);
      } catch (e) {
        copyBtn.textContent = '复制失败';
      }
    });

    // 查看代码
    const details = document.createElement('details');
    details.className = 'code-details';
    const summary = document.createElement('summary');
    summary.textContent = '查看代码';
    const code = document.createElement('code');
    code.className = 'code';
    code.textContent = item.code;
    details.appendChild(summary);
    details.appendChild(code);

    card.appendChild(preview);
    card.appendChild(info);
    card.appendChild(copyBtn);
    card.appendChild(details);

    // 在画布挂载后再绘制准星
    requestAnimationFrame(function () {
      if (window.Crosshair && window.Crosshair.render) {
        window.Crosshair.render(canvas, item.code);
        rendered.push({ canvas: canvas, code: item.code });
      }
    });

    return card;
  }

  function matches(item, q) {
    if (!q) return true;
    const hay = normalize([
      item.name, item.alias, item.cn, item.team,
      (item.tags || []).join(' ')
    ].join(' '));
    return hay.includes(normalize(q));
  }

  function render() {
    const q = searchInput.value.trim();
    communityGrid.innerHTML = '';
    prosGrid.innerHTML = '';

    const community = data.community.filter(function (i) { return matches(i, q); });
    const pros = data.pros.filter(function (i) { return matches(i, q); });

    community.forEach(function (i) { communityGrid.appendChild(makeCard(i)); });
    pros.forEach(function (i) { prosGrid.appendChild(makeCard(i)); });

    if (community.length === 0) {
      communityGrid.innerHTML = '<p class="empty">没有找到相关准星</p>';
    }
    if (pros.length === 0) {
      prosGrid.innerHTML = '<p class="empty">没有找到相关选手</p>';
    }
  }

  tabButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      const tab = btn.dataset.tab;
      tabButtons.forEach(function (b) { b.classList.toggle('active', b === btn); });
      document.getElementById('panel-community').classList.toggle('hidden', tab !== 'community');
      document.getElementById('panel-pros').classList.toggle('hidden', tab !== 'pros');
    });
  });

  searchInput.addEventListener('input', render);

  // 窗口缩放时重绘所有准星（保持清晰、不变形）
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      rendered.forEach(function (r) {
        if (window.Crosshair && window.Crosshair.render) {
          window.Crosshair.render(r.canvas, r.code);
        }
      });
    }, 150);
  });

  // 异步加载数据（联网优先，失败回退内置数据）
  async function init() {
    if (window.api && window.api.getData) {
      try {
        data = await window.api.getData();
      } catch (e) {
        data = { community: [], pros: [] };
      }
    }
    document.getElementById('community-count').textContent = data.community.length;
    document.getElementById('pros-count').textContent = data.pros.length;
    render();
  }

  init();
})();
