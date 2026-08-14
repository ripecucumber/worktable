/* ============================================================
   projects.js — 项目
   记录正在进行的项目：名称/描述、进度（0-100% 可拖动/手动输入）、
   每个项目自动关联一个同名文件夹，项目笔记归入该文件夹
   （笔记模块中也能看到并编辑这些文件夹）
   ============================================================ */

(function () {
  const viewId = 'projects';
  const el = document.getElementById('view-' + viewId);

  // 界面状态
  let editingProjectId = null;           // 正在编辑的项目 id
  let expandedId = null;                 // 展开显示笔记的项目 id
  let noteEditing = null;                // { projectId, noteId } 正在编辑的项目笔记
  let viewingNoteId = null;              // 正在弹窗查看的笔记 id
  let projSaveTimer = null;              // 项目笔记自动保存防抖定时器

  /** 立即执行项目笔记表单的待保存内容（切换视图时由 app.js 调用） */
  function flushProjectNote() {
    clearTimeout(projSaveTimer);
    projSaveTimer = null;
    const form = el.querySelector('.proj-note-form');
    if (form) saveProjectNote(form, true);
  }

  /** 确保存在同名文件夹（项目与文件夹共用名称，重名时复用） */
  function ensureFolder(name) {
    let f = Worktable.data.folders.find(x => x.name === name);
    if (!f) {
      f = { id: Worktable.uid(), name: name, createdAt: new Date().toISOString() };
      Worktable.data.folders.push(f);
    }
    return f.id;
  }

  /** 项目文件夹下的笔记 */
  function projectNotes(project) {
    return Worktable.data.notes
      .filter(n => n.folderId === project.folderId)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  /** 项目笔记列表的 HTML（列表 + 阅读弹窗入口） */
  function notesListHtml(project) {
    const notes = projectNotes(project);
    if (notes.length === 0) return '<div class="empty">这个项目还没有笔记</div>';
    return notes.map(n => `
        <div class="dash-item proj-note-row" data-proj-act="view" data-note="${n.id}" title="点击查看笔记内容">
          <span>📝</span>
          <span class="dash-title">${Worktable.escapeHtml(n.title || '（无标题）')}</span>
          <span class="badge badge-tag">${Worktable.escapeHtml(Worktable.localDateOf(n.updatedAt))}</span>
          <button type="button" class="icon-btn" data-proj-act="note-edit" data-project="${project.id}" data-note="${n.id}" title="编辑笔记">✏️</button>
          <button type="button" class="icon-btn" data-proj-act="note-del" data-project="${project.id}" data-note="${n.id}" title="删除笔记">🗑️</button>
        </div>`).join('');
  }

  /** 局部更新某项目展开区的笔记列表、计数与保存提示（不整页重建，保持输入焦点） */
  function renderProjectNotes(project, saved) {
    const listEl = document.getElementById('proj-notes-' + project.id);
    if (listEl) listEl.innerHTML = notesListHtml(project);
    const countEl = document.getElementById('proj-count-' + project.id);
    if (countEl) countEl.textContent = projectNotes(project).length;
    if (saved) {
      const hintEl = document.getElementById('proj-save-hint-' + project.id);
      if (hintEl) hintEl.textContent = '✓ 已自动保存';
    }
  }

  /** 项目笔记自动保存：读取表单并保存（新建时第一次非空输入自动创建） */
  function saveProjectNote(form, saved) {
    const project = Worktable.data.projects.find(p => p.id === form.dataset.project);
    if (!project) return;
    const title = form.title.value.trim();
    const content = form.content.value;
    const tags = String(form.tags.value || '').split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    const now = new Date().toISOString();

    if (noteEditing && noteEditing.projectId === project.id) {
      const note = Worktable.data.notes.find(n => n.id === noteEditing.noteId);
      if (note) {
        note.title = title;
        note.content = content;
        note.tags = tags;
        note.updatedAt = now;
        Worktable.saveData();
        renderProjectNotes(project, saved);
      }
      return;
    }

    // 新建模式：标题和内容都为空则不创建
    if (!title && !content.trim()) return;
    const note = {
      id: Worktable.uid(),
      title: title,
      content: content,
      type: 'note',
      language: '',
      tags: tags,
      folderId: project.folderId,
      createdAt: now,
      updatedAt: now
    };
    Worktable.data.notes.push(note);
    noteEditing = { projectId: project.id, noteId: note.id };
    Worktable.saveData();
    renderProjectNotes(project, saved);
  }

  function render() {
    const editing = editingProjectId ? Worktable.data.projects.find(p => p.id === editingProjectId) : null;
    const projects = Worktable.data.projects.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

    el.innerHTML = `
      <h1 class="page-title">📦 项目</h1>

      <div class="card" style="margin-bottom: 14px;">
        <h3>${editingProjectId ? '✏️ 编辑项目' : '✨ 新建项目'}</h3>
        <form id="project-form" class="form-row" autocomplete="off">
          <input name="name" class="input grow" placeholder="项目名称，如：毕业设计" required
                 value="${Worktable.escapeHtml(editing ? editing.name : '')}">
          <input name="description" class="input grow" placeholder="项目描述（可选）"
                 value="${Worktable.escapeHtml(editing ? editing.description : '')}">
          <button type="submit" class="btn btn-primary">${editingProjectId ? '保存修改' : '创建项目'}</button>
          <button type="button" class="btn ${editingProjectId ? '' : 'hidden'}" data-proj-act="cancel-edit">取消编辑</button>
        </form>
        <p class="settings-note" style="margin-top:8px;">💡 创建项目时会自动创建一个同名文件夹，项目的笔记都会放进这个文件夹（可在「笔记 & 代码」中查看和编辑）。</p>
      </div>

      <div id="project-list">
        ${projects.length === 0
          ? '<div class="empty">还没有项目，从上方创建一个吧</div>'
          : projects.map(projectCard).join('')}
      </div>
    `;

    // 若正在查看某条笔记，弹出阅读弹窗
    if (viewingNoteId) renderNoteModal();
  }

  /** 单个项目卡片 */
  function projectCard(p) {
    const notes = projectNotes(p);
    const expanded = expandedId === p.id;
    const noteEditingNote = noteEditing && noteEditing.projectId === p.id
      ? Worktable.data.notes.find(n => n.id === noteEditing.noteId) : null;

    return `
      <div class="card project-card" style="margin-bottom: 14px;">
        <div class="project-head">
          <span class="project-name">📦 ${Worktable.escapeHtml(p.name)}</span>
          <span class="badge badge-project">${p.progress}%</span>
          <div class="task-actions" style="margin-left:auto;">
            <button type="button" class="icon-btn" data-proj-act="expand" data-id="${p.id}" title="${expanded ? '收起' : '展开笔记'}">${expanded ? '🔼' : '🔽'}</button>
            <button type="button" class="icon-btn" data-proj-act="edit" data-id="${p.id}" title="编辑项目">✏️</button>
            <button type="button" class="icon-btn" data-proj-act="del" data-id="${p.id}" title="删除项目">🗑️</button>
          </div>
        </div>
        ${p.description ? `<div class="project-desc">${Worktable.escapeHtml(p.description)}</div>` : ''}

        <div class="project-progress">
          <span style="font-size:13px;color:var(--text-secondary);flex-shrink:0;">进度</span>
          <input type="range" class="proj-progress-range" min="0" max="100" step="1" value="${p.progress}" data-id="${p.id}">
          <input type="number" class="input proj-progress-num" min="0" max="100" value="${p.progress}" data-id="${p.id}" style="width:70px;">
          <span class="badge badge-project proj-progress-label">${p.progress}%</span>
        </div>

        ${expanded ? `
          <div class="project-notes">
            <h4>📝 项目笔记（<span id="proj-count-${p.id}">${notes.length}</span>）</h4>
            <form class="proj-note-form form-col" data-project="${p.id}" autocomplete="off" style="margin-bottom:10px;">
              <div class="form-row">
                <input name="title" class="input grow" placeholder="笔记标题（可留空）" value="${Worktable.escapeHtml(noteEditingNote ? noteEditingNote.title : '')}">
                <input name="tags" class="input" placeholder="标签，逗号分隔" style="flex:1;min-width:120px;"
                       value="${Worktable.escapeHtml(noteEditingNote ? (noteEditingNote.tags || []).join(', ') : '')}">
                <span id="proj-save-hint-${p.id}" style="font-size:12px;color:var(--success);"></span>
              </div>
              <textarea name="content" class="textarea" placeholder="支持 Markdown 内容，输入后自动保存…" style="min-height:80px;">${Worktable.escapeHtml(noteEditingNote ? noteEditingNote.content : '')}</textarea>
            </form>
            <div id="proj-notes-${p.id}">${notesListHtml(p)}</div>
          </div>` : ''}
      </div>`;
  }

  /** 阅读弹窗：查看项目笔记内容（Markdown 渲染） */
  function renderNoteModal() {
    const note = viewingNoteId ? Worktable.data.notes.find(n => n.id === viewingNoteId) : null;
    if (!note) return;
    const contentHtml = Worktable.mdToHtml(note.content);
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'note-modal';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <span class="modal-title">📝 ${Worktable.escapeHtml(note.title || '（无标题）')}</span>
          <button type="button" class="icon-btn" data-modal-close title="关闭">✖️</button>
        </div>
        <div class="modal-meta">
          ${note.type === 'code' ? '<span class="badge badge-mid">💻 代码片段</span>' : ''}
          ${note.language ? `<span class="badge badge-tag">${Worktable.escapeHtml(note.language)}</span>` : ''}
          ${(note.tags || []).map(t => `<span class="badge badge-tag">#${Worktable.escapeHtml(t)}</span>`).join('')}
          <span class="badge badge-project">更新于 ${Worktable.escapeHtml(Worktable.localDateOf(note.updatedAt))}</span>
        </div>
        <div class="modal-body md-body">${contentHtml}</div>
        <div class="modal-foot">
          <button type="button" class="btn btn-primary" data-modal-edit>✏️ 编辑</button>
          <button type="button" class="btn" data-modal-close>关闭</button>
        </div>
      </div>`;
    el.appendChild(modal);
  }

  function startEditProject(id) {
    editingProjectId = id;
    render();
    el.querySelector('#project-form').name.focus();
  }

  function cancelEditProject() {
    editingProjectId = null;
    render();
  }

  function init() {
    // 新建 / 编辑项目
    el.addEventListener('submit', function (e) {
      const form = e.target.closest('#project-form');
      if (!form) return;
      e.preventDefault();
      const name = form.name.value.trim();
      if (!name) { Worktable.toast('项目名称不能为空'); return; }
      const now = new Date().toISOString();

      if (editingProjectId) {
        const project = Worktable.data.projects.find(p => p.id === editingProjectId);
        if (project) {
          const oldName = project.name;
          project.name = name;
          project.description = form.description.value.trim();
          project.updatedAt = now;
          // 同步重命名关联文件夹
          if (project.folderId) {
            const folder = Worktable.data.folders.find(f => f.id === project.folderId);
            if (folder) folder.name = name;
          }
        }
        editingProjectId = null;
        Worktable.toast('已保存修改');
      } else {
        const folderId = ensureFolder(name);
        Worktable.data.projects.push({
          id: Worktable.uid(),
          name: name,
          description: form.description.value.trim(),
          progress: 0,
          folderId: folderId,
          createdAt: now,
          updatedAt: now
        });
        Worktable.toast('项目「' + name + '」已创建');
      }
      Worktable.saveData();
      render();
    });

    el.addEventListener('click', function (e) {
      // 点击遮罩空白处关闭弹窗
      if (e.target.classList.contains('modal-overlay')) {
        const overlay = el.querySelector('#note-modal');
        if (overlay) overlay.remove();
        viewingNoteId = null;
        return;
      }
      // 弹窗内复制代码块
      const copyBtn = e.target.closest('.btn-copy');
      if (copyBtn) {
        const block = copyBtn.closest('.code-block');
        const code = block ? block.querySelector('pre code').textContent : '';
        Worktable.copyText(code).then(ok => Worktable.toast(ok ? '已复制代码' : '复制失败'));
        return;
      }
      // 弹窗：关闭 / 编辑
      const modalClose = e.target.closest('[data-modal-close]');
      if (modalClose) {
        const overlay = el.querySelector('#note-modal');
        if (overlay) overlay.remove();
        viewingNoteId = null;
        return;
      }
      const modalEdit = e.target.closest('[data-modal-edit]');
      if (modalEdit) {
        const note = Worktable.data.notes.find(n => n.id === viewingNoteId);
        const project = note ? Worktable.data.projects.find(p => p.folderId === note.folderId) : null;
        const overlay = el.querySelector('#note-modal');
        if (overlay) overlay.remove();
        viewingNoteId = null;
        if (note && project) {
          noteEditing = { projectId: project.id, noteId: note.id };
          expandedId = project.id;
          render();
        }
        return;
      }

      const btn = e.target.closest('[data-proj-act]');
      if (!btn) return;
      const act = btn.dataset.projAct;
      const id = btn.dataset.id;

      if (act === 'cancel-edit') { cancelEditProject(); return; }

      const project = id ? Worktable.data.projects.find(p => p.id === id) : null;

      if (act === 'view') {
        viewingNoteId = btn.dataset.note;
        render();
      }
      else if (act === 'edit') { if (project) startEditProject(id); }
      else if (act === 'del') {
        if (project && confirm('确定要删除项目「' + project.name + '」吗？\n同名文件夹也会被删除，文件夹内的笔记会变为「未分类」（笔记本身不会删除）。')) {
          Worktable.data.projects = Worktable.data.projects.filter(p => p.id !== id);
          if (project.folderId) {
            Worktable.data.folders = Worktable.data.folders.filter(f => f.id !== project.folderId);
            Worktable.data.notes.forEach(n => { if (n.folderId === project.folderId) n.folderId = ''; });
          }
          if (expandedId === id) expandedId = null;
          if (editingProjectId === id) editingProjectId = null;
          Worktable.saveData();
          render();
          Worktable.toast('项目已删除');
        }
      }
      else if (act === 'expand') {
        expandedId = expandedId === id ? null : id;
        noteEditing = null;
        viewingNoteId = null;
        render();
      }
      else if (act === 'note-cancel') {
        noteEditing = null;
        render();
      }
      else if (act === 'note-edit') {
        viewingNoteId = null;
        noteEditing = { projectId: btn.dataset.project, noteId: btn.dataset.note };
        render();
      }
      else if (act === 'note-del') {
        const note = Worktable.data.notes.find(n => n.id === btn.dataset.note);
        if (note && confirm('确定要删除笔记「' + (note.title || '无标题笔记') + '」吗？')) {
          Worktable.data.notes = Worktable.data.notes.filter(n => n.id !== note.id);
          if (noteEditing && noteEditing.noteId === note.id) noteEditing = null;
          if (viewingNoteId === note.id) viewingNoteId = null;
          Worktable.saveData();
          render();
          Worktable.toast('已删除');
        }
      }
    });

    // 项目笔记自动保存：输入防抖保存（700ms）
    el.addEventListener('input', function (e) {
      const form = e.target.closest('.proj-note-form');
      if (!form) return;
      const name = e.target.name;
      if (name === 'title' || name === 'tags' || name === 'content') {
        clearTimeout(projSaveTimer);
        projSaveTimer = setTimeout(function () { saveProjectNote(form, true); }, 700);
      }
    });

    // 进度修改：滑块 / 数字输入
    // 注意：number/text 输入框的 change 事件不冒泡，事件委托收不到，
    // 因此数字输入框用 input 事件即时保存，滑块用 change（冒泡）+ input（实时显示）
    function syncProgressUI(card, value) {
      if (!card) return;
      const rangeEl = card.querySelector('.proj-progress-range');
      const numEl = card.querySelector('.proj-progress-num');
      const labelEl = card.querySelector('.proj-progress-label');
      const headBadge = card.querySelector('.project-head .badge');
      if (rangeEl) rangeEl.value = value;
      if (numEl) numEl.value = value;
      if (labelEl) labelEl.textContent = value + '%';
      if (headBadge) headBadge.textContent = value + '%';
    }

    function applyProgress(e) {
      const range = e.target.closest('.proj-progress-range');
      const num = e.target.closest('.proj-progress-num');
      if (!range && !num) return false;
      let value;
      if (range) value = parseInt(range.value, 10);
      else value = Math.max(0, Math.min(100, parseInt(num.value, 10) || 0));
      const projId = (range || num).dataset.id;
      const project = Worktable.data.projects.find(p => p.id === projId);
      if (!project) return false;
      project.progress = value;
      project.updatedAt = new Date().toISOString();
      Worktable.saveData();
      syncProgressUI(e.target.closest('.project-card'), value);
      return true;
    }

    el.addEventListener('change', function (e) { applyProgress(e); });

    // 拖动滑块时实时同步数字显示；数字输入时即时保存
    el.addEventListener('input', function (e) {
      const num = e.target.closest('.proj-progress-num');
      if (num) { applyProgress(e); return; }
      const range = e.target.closest('.proj-progress-range');
      if (range) {
        syncProgressUI(range.closest('.project-card'), parseInt(range.value, 10));
      }
    });
  }

  Worktable.register(viewId, { init: init, render: render, flush: flushProjectNote });
  init();
})();
