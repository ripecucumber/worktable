/* ============================================================
   bookmarks.js — 书签收藏
   收藏网址（标题/标签/备注）、点击新窗口打开、搜索、按标签筛选、复制链接
   ============================================================ */

(function () {
  const viewId = 'bookmarks';
  const el = document.getElementById('view-' + viewId);

  // 界面状态
  let search = '';
  let tagFilter = '';
  let editingId = null;

  /** 提取网址域名用于展示 */
  function domainOf(url) {
    try { return new URL(url).hostname; } catch (e) { return url; }
  }

  /** 全部标签（去重排序） */
  function tagList() {
    const set = {};
    Worktable.data.bookmarks.forEach(b => (b.tags || []).forEach(t => { if (t) set[t] = true; }));
    return Object.keys(set).sort();
  }

  function filteredBookmarks() {
    const kw = search.trim().toLowerCase();
    return Worktable.data.bookmarks
      .filter(b => {
        if (tagFilter && !(b.tags || []).includes(tagFilter)) return false;
        if (!kw) return true;
        return ((b.title || '') + ' ' + (b.url || '') + ' ' + (b.description || '') + ' ' + (b.tags || []).join(' ')).toLowerCase().includes(kw);
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  function renderList() {
    const list = filteredBookmarks();
    document.getElementById('bookmark-list').innerHTML = list.length === 0
      ? '<div class="empty">没有符合条件的书签</div>'
      : list.map(b => `
          <div class="bookmark-item card" style="box-shadow:none;">
            <span class="bm-icon">🔗</span>
            <div class="bm-info">
              <a class="bm-title" href="${Worktable.escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${Worktable.escapeHtml(b.title || b.url)}</a>
              <div class="bm-url">${Worktable.escapeHtml(domainOf(b.url))}</div>
              ${b.description ? `<div class="bm-desc">${Worktable.escapeHtml(b.description)}</div>` : ''}
              <div class="bm-tags">${(b.tags || []).map(t => `<span class="badge badge-tag">#${Worktable.escapeHtml(t)}</span>`).join('')}</div>
            </div>
            <div class="bm-actions">
              <button type="button" class="icon-btn" data-act="copy" data-id="${b.id}" title="复制链接">📋</button>
              <button type="button" class="icon-btn" data-act="edit" data-id="${b.id}" title="编辑">✏️</button>
              <button type="button" class="icon-btn" data-act="del" data-id="${b.id}" title="删除">🗑️</button>
            </div>
          </div>`).join('');

    const countEl = document.getElementById('bookmark-count');
    if (countEl) countEl.textContent = `共 ${list.length} 条`;
  }

  function render() {
    const editing = editingId ? Worktable.data.bookmarks.find(b => b.id === editingId) : null;
    const tags = tagList();

    el.innerHTML = `
      <h1 class="page-title">🔖 书签收藏</h1>

      <div class="card" style="margin-bottom: 14px;">
        <form id="bookmark-form" class="form-col" autocomplete="off">
          <div class="form-row">
            <input name="url" class="input grow" placeholder="网址，如 https://example.com" required
                   value="${Worktable.escapeHtml(editing ? editing.url : '')}">
            <input name="title" class="input grow" placeholder="标题（留空则用网址）"
                   value="${Worktable.escapeHtml(editing ? editing.title : '')}">
          </div>
          <div class="form-row">
            <input name="tags" class="input grow" placeholder="标签，逗号分隔，如：学习, 工具"
                   value="${Worktable.escapeHtml((editing ? editing.tags || [] : []).join(', '))}">
            <input name="desc" class="input grow" placeholder="备注（可选）"
                   value="${Worktable.escapeHtml(editing ? editing.description : '')}">
            <button type="submit" class="btn btn-primary">保存</button>
            <button type="button" class="btn ${editingId ? '' : 'hidden'}" data-act="cancel-edit">取消编辑</button>
          </div>
        </form>
      </div>

      <div class="card">
        <div class="task-toolbar">
          <input id="bookmark-search" class="input grow" placeholder="🔍 搜索标题、网址、标签…" value="${Worktable.escapeHtml(search)}">
          <select id="bookmark-tag" class="select">
            <option value="">全部标签</option>
            ${tags.map(t => `<option value="${Worktable.escapeHtml(t)}" ${tagFilter === t ? 'selected' : ''}>#${Worktable.escapeHtml(t)}</option>`).join('')}
          </select>
          <span id="bookmark-count" style="color: var(--text-secondary); font-size: 13px;"></span>
        </div>
        <div id="bookmark-list"></div>
      </div>
    `;

    renderList();
  }

  function startEdit(id) {
    editingId = id;
    render();
    el.querySelector('#bookmark-form').url.focus();
  }

  function cancelEdit() {
    editingId = null;
    render();
  }

  function init() {
    // 保存 / 新建
    el.addEventListener('submit', function (e) {
      const form = e.target.closest('#bookmark-form');
      if (!form) return;
      e.preventDefault();
      const url = form.url.value.trim();
      if (!url) { Worktable.toast('网址不能为空'); return; }
      const now = new Date().toISOString();
      const tags = String(form.tags.value || '').split(/[,，、]/).map(s => s.trim()).filter(Boolean);

      if (editingId) {
        const bm = Worktable.data.bookmarks.find(b => b.id === editingId);
        if (bm) {
          bm.url = url;
          bm.title = form.title.value.trim() || url;
          bm.tags = tags;
          bm.description = form.desc.value.trim();
        }
        editingId = null;
        Worktable.toast('已保存修改');
      } else {
        Worktable.data.bookmarks.push({
          id: Worktable.uid(),
          url: url,
          title: form.title.value.trim() || url,
          tags: tags,
          description: form.desc.value.trim(),
          createdAt: now
        });
        Worktable.toast('已收藏');
      }
      Worktable.saveData();
      render();
    });

    el.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      const bm = Worktable.data.bookmarks.find(b => b.id === id);
      if (!bm) return;

      if (btn.dataset.act === 'edit') { startEdit(id); }
      else if (btn.dataset.act === 'del') {
        if (confirm('确定要删除书签「' + bm.title + '」吗？')) {
          Worktable.data.bookmarks = Worktable.data.bookmarks.filter(b => b.id !== id);
          if (editingId === id) editingId = null;
          Worktable.saveData();
          render();
          Worktable.toast('已删除');
        }
      }
      else if (btn.dataset.act === 'copy') {
        Worktable.copyText(bm.url).then(ok => Worktable.toast(ok ? '链接已复制' : '复制失败'));
      }
      else if (btn.dataset.act === 'cancel-edit') { cancelEdit(); }
    });

    // 搜索（只重建列表）
    el.addEventListener('input', function (e) {
      if (e.target.id === 'bookmark-search') {
        search = e.target.value;
        renderList();
      }
    });

    // 标签筛选（只重建列表）
    el.addEventListener('change', function (e) {
      if (e.target.id === 'bookmark-tag') {
        tagFilter = e.target.value;
        renderList();
      }
    });
  }

  Worktable.register(viewId, { init: init, render: render });
  init();
})();
