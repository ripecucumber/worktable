/* ============================================================
   notes.js — 笔记 & 代码片段
   Markdown 编写 + 实时预览、标签、搜索、类型筛选、
   代码片段（语言标记 + 一键复制）
   ============================================================ */

(function () {
  const viewId = 'notes';
  const el = document.getElementById('view-' + viewId);

  // 界面状态
  let search = '';
  let filterType = 'all';     // all | note | code
  let folderFilter = 'all';   // all | none | 文件夹id
  let editingId = null;
  let previewMode = false;    // false=编辑 true=预览
  let creatingFolder = false; // 正在新建文件夹
  let renamingFolderId = null; // 正在重命名的文件夹 id
  let saveTimer = null;       // 自动保存防抖定时器

  const TYPE_LABEL = { note: '📝 笔记', code: '💻 代码片段' };

  /** 读取编辑器表单当前值 */
  function getFormData() {
    const form = el.querySelector('#note-form');
    if (!form) return null;
    return {
      title: form.title.value.trim(),
      content: form.content.value,
      type: form.type.value,
      language: form.language.value.trim(),
      tags: String(form.tags.value || '').split(/[,，、]/).map(s => s.trim()).filter(Boolean),
      folderId: form.folder.value
    };
  }

  /** 更新表单区头部状态（新建/编辑中）与"已自动保存"提示 */
  function updateFormHeader() {
    const header = el.querySelector('#note-form-head');
    if (header) header.textContent = editingId ? '✏️ 编辑中' : '✨ 新建';
    const hint = el.querySelector('#note-save-hint');
    if (hint) hint.textContent = '✓ 已自动保存';
  }

  /** 立即保存当前表单内容（自动保存核心） */
  function saveCurrent() {
    const data = getFormData();
    if (!data) return;
    const now = new Date().toISOString();

    if (editingId) {
      const note = Worktable.data.notes.find(n => n.id === editingId);
      if (note) {
        note.title = data.title;
        note.content = data.content;
        note.type = data.type;
        note.language = data.type === 'code' ? data.language : '';
        note.tags = data.tags;
        note.folderId = data.folderId;
        note.updatedAt = now;
        Worktable.saveData();
        renderList();
        updateFormHeader();
      }
      return;
    }

    // 新建模式：标题和内容都为空则不创建
    if (!data.title && !data.content.trim()) return;
    const note = {
      id: Worktable.uid(),
      title: data.title,
      content: data.content,
      type: data.type,
      language: data.type === 'code' ? data.language : '',
      tags: data.tags,
      folderId: data.folderId,
      createdAt: now,
      updatedAt: now
    };
    Worktable.data.notes.push(note);
    editingId = note.id; // 进入编辑态，后续输入持续更新同一篇
    Worktable.saveData();
    renderList();
    updateFormHeader();
  }

  /** 防抖自动保存（输入停止 700ms 后保存） */
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrent, 700);
  }

  /** 立即执行待保存内容（切换视图时由 app.js 调用） */
  function flush() {
    clearTimeout(saveTimer);
    saveTimer = null;
    saveCurrent();
  }

  /** 回到新建状态（清空表单，放弃当前草稿） */
  function startNewNote() {
    clearTimeout(saveTimer); // 放弃未保存的输入，不创建草稿
    saveTimer = null;
    editingId = null;
    previewMode = false;
    render();
    const titleInput = el.querySelector('#note-form .title-input');
    if (titleInput) titleInput.focus();
  }

  /** 根据文件夹 id 查名称 */
  function folderName(id) {
    const f = Worktable.data.folders.find(x => x.id === id);
    return f ? f.name : '';
  }

  /** 标签输入框的逗号分隔字符串 → 数组 */
  function parseTags(str) {
    return String(str || '').split(/[,，、]/).map(s => s.trim()).filter(Boolean);
  }

  function filteredNotes() {
    const kw = search.trim().toLowerCase();
    return Worktable.data.notes
      .filter(n => {
        if (filterType !== 'all' && n.type !== filterType) return false;
        if (folderFilter === 'none' && n.folderId) return false;
        if (folderFilter !== 'all' && folderFilter !== 'none' && n.folderId !== folderFilter) return false;
        if (!kw) return true;
        const haystack = ((n.title || '') + ' ' + (n.content || '') + ' ' + (n.tags || []).join(' ')).toLowerCase();
        return haystack.includes(kw);
      })
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  /** 只重建列表区域（搜索时保持输入框焦点） */
  function renderList() {
    const list = filteredNotes();
    document.getElementById('note-list').innerHTML = list.length === 0
      ? '<div class="empty">没有找到笔记</div>'
      : list.map(n => {
          const excerpt = String(n.content || '').replace(/\n/g, ' ').slice(0, 60);
          const fname = n.folderId ? folderName(n.folderId) : '';
          return `
            <div class="note-item" data-id="${n.id}">
              <div class="note-title">
                ${n.type === 'code' ? '💻' : '📝'}
                <span class="dash-title" style="flex:1">${Worktable.escapeHtml(n.title || '（无标题）')}</span>
                <span class="note-time">${Worktable.escapeHtml(Worktable.localDateOf(n.updatedAt))}</span>
              </div>
              <div class="note-excerpt">${Worktable.escapeHtml(excerpt)}</div>
              <div class="note-tags">
                ${fname ? `<span class="badge badge-folder">📁 ${Worktable.escapeHtml(fname)}</span>` : ''}
                ${(n.tags || []).map(t => `<span class="badge badge-tag">#${Worktable.escapeHtml(t)}</span>`).join('')}
              </div>
              <div class="note-actions">
                <button type="button" class="icon-btn" data-act="edit" data-id="${n.id}" title="编辑">✏️</button>
                <button type="button" class="icon-btn" data-act="del" data-id="${n.id}" title="删除">🗑️</button>
              </div>
            </div>`;
        }).join('');

    const countEl = document.getElementById('note-count');
    if (countEl) countEl.textContent = `共 ${list.length} 条`;
  }

  /** 只重建左侧文件夹栏（新建/重命名状态变化时） */
  function renderFolderBar() {
    const folders = Worktable.data.folders.slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const countOf = function (folderId) {
      return Worktable.data.notes.filter(n => n.folderId === folderId).length;
    };
    const noneCount = Worktable.data.notes.filter(n => !n.folderId).length;

    const item = function (filterVal, icon, name, count, extra) {
      return `
        <div class="folder-item ${folderFilter === filterVal ? 'active' : ''}" data-filter="${filterVal}" title="${Worktable.escapeHtml(name)}">
          <span class="folder-icon">${icon}</span>
          <span class="folder-name">${Worktable.escapeHtml(name)}</span>
          <span class="folder-count">${count}</span>
          ${extra || ''}
        </div>`;
    };

    let html = '';
    html += item('all', '📚', '全部笔记', Worktable.data.notes.length);
    html += item('none', '📄', '未分类', noneCount);

    folders.forEach(f => {
      if (renamingFolderId === f.id) {
        // 重命名行内编辑
        html += `
          <div class="folder-item folder-renaming">
            <input id="folder-rename-input" class="input" value="${Worktable.escapeHtml(f.name)}" data-rename-id="${f.id}">
            <button type="button" class="icon-btn" data-folder-act="rename-ok" data-id="${f.id}" title="保存">✔️</button>
            <button type="button" class="icon-btn" data-folder-act="rename-cancel" title="取消">✖️</button>
          </div>`;
      } else {
        html += item(f.id, '📁', f.name, countOf(f.id), `
          <button type="button" class="icon-btn folder-btn" data-folder-act="rename" data-id="${f.id}" title="重命名">✏️</button>
          <button type="button" class="icon-btn folder-btn" data-folder-act="del" data-id="${f.id}" title="删除">🗑️</button>`);
      }
    });

    // 新建文件夹行内表单
    if (creatingFolder) {
      html += `
        <div class="folder-item folder-renaming">
          <input id="folder-new-name" class="input" placeholder="文件夹名称…">
          <button type="button" class="icon-btn" data-folder-act="create-ok" title="创建">✔️</button>
          <button type="button" class="icon-btn" data-folder-act="create-cancel" title="取消">✖️</button>
        </div>`;
    }

    document.getElementById('folder-list').innerHTML = html || '<div class="empty">暂无文件夹</div>';
  }

  /** 刷新编辑器里的"所属文件夹"下拉（保留当前选中值） */
  function renderFolderSelect() {
    const select = el.querySelector('#note-form [name=folder]');
    if (!select) return;
    const current = select.value;
    const folders = Worktable.data.folders.slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    select.innerHTML = '<option value="">📄 未分类</option>'
      + folders.map(f => `<option value="${f.id}">📁 ${Worktable.escapeHtml(f.name)}</option>`).join('');
    // 若当前选中的文件夹仍存在则保留，否则回落到未分类
    if (current && Worktable.data.folders.some(f => f.id === current)) select.value = current;
  }

  function render() {
    const editing = editingId ? Worktable.data.notes.find(n => n.id === editingId) : null;
    const type = editing ? editing.type : 'note';
    const folders = Worktable.data.folders.slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const currentFolderId = editing ? (editing.folderId || '') : '';

    el.innerHTML = `
      <h1 class="page-title">📝 笔记 & 代码片段</h1>

      <div class="notes-layout">
        <div class="card folder-side">
          <h3 style="display:flex;align-items:center;justify-content:space-between;">📁 文件夹</h3>
          <button type="button" class="btn btn-sm btn-primary" id="btn-new-folder" style="width:100%;margin-bottom:10px;">＋ 新建文件夹</button>
          <div id="folder-list"></div>
        </div>

        <div>
          <div class="card">
            <div class="task-toolbar">
              <input id="note-search" class="input grow" placeholder="🔍 搜索标题、内容或标签…" value="${Worktable.escapeHtml(search)}">
              <select id="note-type" class="select">
                <option value="all" ${filterType === 'all' ? 'selected' : ''}>全部</option>
                <option value="note" ${filterType === 'note' ? 'selected' : ''}>📝 笔记</option>
                <option value="code" ${filterType === 'code' ? 'selected' : ''}>💻 代码片段</option>
              </select>
              <span id="note-count" style="color: var(--text-secondary); font-size: 13px;"></span>
            </div>
            <div id="note-list"></div>
          </div>
        </div>

        <div class="card">
          <h3 style="display:flex;align-items:center;gap:8px;">
            <span id="note-form-head">${editingId ? '✏️ 编辑中' : '✨ 新建'}</span>
            <span id="note-save-hint" style="font-size:12px;color:var(--success);font-weight:400;"></span>
            <span style="flex:1"></span>
            <button type="button" class="btn btn-sm" data-act="new-note">＋ 新建</button>
          </h3>
          <form id="note-form" class="form-col" autocomplete="off">
            <input name="title" class="input title-input" placeholder="标题（可留空）" value="${Worktable.escapeHtml(editing ? editing.title : '')}">
            <div class="note-meta-row">
              <select name="folder" class="select" title="所属文件夹">
                <option value="">📄 未分类</option>
                ${folders.map(f => `<option value="${f.id}" ${currentFolderId === f.id ? 'selected' : ''}>📁 ${Worktable.escapeHtml(f.name)}</option>`).join('')}
              </select>
              <select name="type" class="select">
                <option value="note" ${type === 'note' ? 'selected' : ''}>📝 笔记</option>
                <option value="code" ${type === 'code' ? 'selected' : ''}>💻 代码片段</option>
              </select>
              <input name="language" class="input ${type === 'code' ? '' : 'hidden'}" placeholder="语言，如 javascript / python"
                     value="${Worktable.escapeHtml(editing && editing.language || '')}">
              <input name="tags" class="input grow" placeholder="标签，逗号分隔，如：教程, 前端"
                     value="${Worktable.escapeHtml((editing ? editing.tags || [] : []).join(', '))}">
            </div>
            <div class="note-mode-toggle">
              <button type="button" class="btn btn-sm ${previewMode ? '' : 'btn-primary'}" data-mode="edit">✏️ 编辑</button>
              <button type="button" class="btn btn-sm ${previewMode ? 'btn-primary' : ''}" data-mode="preview">👁 预览</button>
            </div>
            <textarea name="content" class="textarea ${previewMode ? 'hidden' : ''}"
              placeholder="支持 Markdown：**加粗**、\`代码\`、\`\`\` 代码块 \`\`\`、列表、链接…">${Worktable.escapeHtml(editing ? editing.content : '')}</textarea>
            <div class="note-preview md-body ${previewMode ? '' : 'hidden'}" id="note-preview"></div>
            <div class="form-row">
              <span style="color: var(--text-secondary); font-size: 12px;">💡 内容输入后自动保存，无需手动保存</span>
            </div>
          </form>
        </div>
      </div>
    `;

    renderFolderBar();
    renderList();

    // 若处于预览模式（如切走视图再回来），重新填充预览内容
    if (previewMode) refreshPreview();
  }

  /** 刷新预览区内容 */
  function refreshPreview() {
    const form = el.querySelector('#note-form');
    const content = form.content.value;
    const type = form.type.value;
    const lang = form.language.value.trim();
    let md = content;
    if (type === 'code' && !content.includes('```')) {
      // 代码片段类型：即使内容里没写 ``` 围栏，预览时也整段作为代码块展示
      md = '```' + lang + '\n' + content + '\n```';
    } else if (lang) {
      // 内容里有围栏但没写语言时，补上语言标记
      md = content.replace(/```\s*$/m, '```' + lang.replace(/[^a-zA-Z0-9+#-]/g, ''));
    }
    document.getElementById('note-preview').innerHTML = Worktable.mdToHtml(md);
  }

  function startEdit(id) {
    editingId = id;
    previewMode = false;
    render();
    el.querySelector('#note-form').title.focus();
  }

  function cancelEdit() {
    editingId = null;
    previewMode = false;
    render();
  }

  function init() {
    // 自动保存：输入内容防抖保存
    el.addEventListener('input', function (e) {
      const name = e.target.name;
      if (name === 'title' || name === 'tags' || name === 'language' || name === 'content') {
        scheduleSave();
      }
    });

    // 类型 / 文件夹切换：立即保存
    el.addEventListener('change', function (e) {
      if (e.target.name === 'type' || e.target.name === 'folder') {
        saveCurrent();
      }
    });

    el.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-act]');
      const modeBtn = e.target.closest('[data-mode]');

      // 编辑 / 删除 / 取消编辑按钮
      if (btn) {
        const id = btn.dataset.id;
        if (btn.dataset.act === 'edit') { startEdit(id); return; }
        if (btn.dataset.act === 'new-note') { startNewNote(); return; }
        if (btn.dataset.act === 'del') {
          const note = Worktable.data.notes.find(n => n.id === id);
          if (note && confirm('确定要删除「' + (note.title || '无标题笔记') + '」吗？')) {
            clearTimeout(saveTimer); // 放弃待保存输入，防止误重建
            saveTimer = null;
            Worktable.data.notes = Worktable.data.notes.filter(n => n.id !== id);
            if (editingId === id) editingId = null;
            Worktable.saveData();
            render();
            Worktable.toast('已删除');
          }
          return;
        }
        if (btn.dataset.act === 'cancel-edit') { cancelEdit(); return; }
      }

      // 编辑 / 预览切换
      if (modeBtn) {
        flush(); // 切换前先保存当前输入
        previewMode = modeBtn.dataset.mode === 'preview';
        const form = el.querySelector('#note-form');
        form.content.classList.toggle('hidden', previewMode);
        document.getElementById('note-preview').classList.toggle('hidden', !previewMode);
        modeBtn.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('btn-primary', b === modeBtn));
        if (previewMode) refreshPreview();
        return;
      }

      // 点击笔记条目 → 编辑
      const item = e.target.closest('.note-item');
      if (item) startEdit(item.dataset.id);
    });

    // 复制代码块内容
    el.addEventListener('click', function (e) {
      const copyBtn = e.target.closest('.btn-copy');
      if (!copyBtn) return;
      const block = copyBtn.closest('.code-block');
      const code = block ? block.querySelector('pre code').textContent : '';
      Worktable.copyText(code).then(ok => Worktable.toast(ok ? '已复制代码' : '复制失败'));
    });

    // 类型切换：代码片段时显示语言输入框
    el.addEventListener('change', function (e) {
      if (e.target.name === 'type') {
        el.querySelector('#note-form').language.classList.toggle('hidden', e.target.value !== 'code');
      }
    });

    // 搜索 / 类型筛选（只重建列表）
    el.addEventListener('input', function (e) {
      if (e.target.id === 'note-search') {
        search = e.target.value;
        renderList();
      }
    });
    el.addEventListener('change', function (e) {
      if (e.target.id === 'note-type') {
        filterType = e.target.value;
        renderList();
      }
    });

    // ---------- 文件夹管理 ----------
    // 新建文件夹按钮
    el.addEventListener('click', function (e) {
      if (e.target.id === 'btn-new-folder') {
        creatingFolder = !creatingFolder;
        renamingFolderId = null;
        renderFolderBar();
        if (creatingFolder) {
          const input = document.getElementById('folder-new-name');
          if (input) input.focus();
        }
        return;
      }

      // 点击文件夹条目筛选
      const filterItem = e.target.closest('[data-filter]');
      if (filterItem && !e.target.closest('[data-folder-act]')) {
        folderFilter = filterItem.dataset.filter;
        renderFolderBar();
        renderList();
        return;
      }

      // 文件夹操作按钮
      const btn = e.target.closest('[data-folder-act]');
      if (!btn) return;
      const act = btn.dataset.folderAct;
      const id = btn.dataset.id;

      if (act === 'create-cancel') { creatingFolder = false; renderFolderBar(); }
      else if (act === 'rename') { renamingFolderId = id; creatingFolder = false; renderFolderBar(); }
      else if (act === 'rename-cancel') { renamingFolderId = null; renderFolderBar(); }
      else if (act === 'create-ok') {
        const name = document.getElementById('folder-new-name').value.trim();
        if (!name) { Worktable.toast('文件夹名称不能为空'); return; }
        if (Worktable.data.folders.some(f => f.name === name)) {
          Worktable.toast('已存在同名文件夹「' + name + '」');
          return;
        }
        Worktable.data.folders.push({ id: Worktable.uid(), name: name, createdAt: new Date().toISOString() });
        Worktable.saveData();
        creatingFolder = false;
        renderFolderBar();
        renderFolderSelect();
        renderList();
        Worktable.toast('文件夹「' + name + '」已创建');
      }
      else if (act === 'rename-ok') {
        const name = document.getElementById('folder-rename-input').value.trim();
        const folder = Worktable.data.folders.find(f => f.id === renamingFolderId);
        if (!name) { Worktable.toast('文件夹名称不能为空'); return; }
        if (folder && Worktable.data.folders.some(f => f.id !== renamingFolderId && f.name === name)) {
          Worktable.toast('已存在同名文件夹「' + name + '」');
          return;
        }
        if (folder) {
          folder.name = name;
          renamingFolderId = null; // 先清除编辑态，再重绘文件夹栏
          Worktable.saveData();
          renderFolderBar();
          renderFolderSelect();
          renderList();
          Worktable.toast('已重命名');
        } else {
          renamingFolderId = null;
          renderFolderBar();
        }
      }
      else if (act === 'del') {
        const folder = Worktable.data.folders.find(f => f.id === id);
        if (folder && confirm('确定要删除文件夹「' + folder.name + '」吗？\n文件夹内的笔记会变为「未分类」，笔记本身不会删除。')) {
          Worktable.data.folders = Worktable.data.folders.filter(f => f.id !== id);
          Worktable.data.notes.forEach(n => { if (n.folderId === id) n.folderId = ''; });
          if (folderFilter === id) folderFilter = 'all';
          Worktable.saveData();
          renderFolderBar();
          renderFolderSelect();
          renderList();
          Worktable.toast('文件夹已删除');
        }
      }
    });

    // 新建/重命名输入框按回车确认
    el.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target.id === 'folder-new-name') {
        e.preventDefault();
        const okBtn = el.querySelector('[data-folder-act="create-ok"]');
        if (okBtn) okBtn.click();
      } else if (e.target.id === 'folder-rename-input') {
        e.preventDefault();
        const okBtn = el.querySelector('[data-folder-act="rename-ok"]');
        if (okBtn) okBtn.click();
      }
    });
  }

  Worktable.register(viewId, { init: init, render: render, flush: flush });
  init();
})();
