/* ============================================================
   tasks.js — 待办任务
   添加/编辑/删除、优先级、截止日期、项目分类、
   完成切换、状态/项目筛选、搜索
   ============================================================ */

(function () {
  const viewId = 'tasks';
  const el = document.getElementById('view-' + viewId);

  // 界面状态（不会保存，刷新后重置为默认）
  let search = '';
  let statusFilter = 'all';   // all | active | done
  let projectFilter = '';
  let editingId = null;       // 正在编辑的任务 id

  const PRIORITY_ORDER = { high: 0, mid: 1, low: 2 };
  const PRIORITY_LABEL = { high: '高', mid: '中', low: '低' };

  /** 从数据中提取去重的项目列表 */
  function projectList() {
    const set = {};
    Worktable.data.tasks.forEach(t => { if (t.project) set[t.project] = true; });
    return Object.keys(set);
  }

  /** 获取筛选后的任务（含排序：未完成在前，按截止日期、优先级排序） */
  function filteredTasks() {
    const kw = search.trim().toLowerCase();
    const list = Worktable.data.tasks.filter(t => {
      if (statusFilter === 'active' && t.done) return false;
      if (statusFilter === 'done' && !t.done) return false;
      if (projectFilter && t.project !== projectFilter) return false;
      if (kw && !((t.title || '').toLowerCase().includes(kw) || (t.project || '').toLowerCase().includes(kw))) return false;
      return true;
    });
    list.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ad = a.dueDate || '9999-12-31', bd = b.dueDate || '9999-12-31';
      if (ad !== bd) return ad < bd ? -1 : 1;
      const ap = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : 2;
      const bp = PRIORITY_ORDER[b.priority] != null ? PRIORITY_ORDER[b.priority] : 2;
      if (ap !== bp) return ap - bp;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    return list;
  }

  /** 只重建任务列表区域（用于搜索/筛选，保持输入框焦点） */
  function renderList() {
    const list = filteredTasks();
    const doneCount = list.filter(t => t.done).length;
    const today = Worktable.today();

    document.getElementById('task-list').innerHTML = list.length === 0
      ? '<div class="empty">没有符合条件的任务</div>'
      : list.map(t => `
          <div class="task-row ${t.done ? 'done' : ''}">
            <input type="checkbox" class="task-checkbox" data-task-id="${t.id}" ${t.done ? 'checked' : ''}>
            <span class="task-title">${Worktable.escapeHtml(t.title)}</span>
            <div class="task-meta">
              <span class="badge badge-${t.priority || 'low'}">${PRIORITY_LABEL[t.priority] || '低'}优先级</span>
              ${t.project ? `<span class="badge badge-project">${Worktable.escapeHtml(t.project)}</span>` : ''}
              ${t.dueDate
                ? `<span class="badge ${!t.done && t.dueDate < today ? 'badge-overdue' : 'badge-tag'}">${Worktable.relativeDue(t.dueDate)}</span>`
                : ''}
            </div>
            <div class="task-actions">
              <button type="button" class="icon-btn" data-act="edit" data-id="${t.id}" title="编辑">✏️</button>
              <button type="button" class="icon-btn" data-act="del" data-id="${t.id}" title="删除">🗑️</button>
            </div>
          </div>`).join('');

    const countEl = document.getElementById('task-count');
    if (countEl) countEl.textContent = `共 ${list.length} 项 · 已完成 ${doneCount} 项`;
  }

  function render() {
    const editing = editingId ? Worktable.data.tasks.find(t => t.id === editingId) : null;
    const projects = projectList();

    el.innerHTML = `
      <h1 class="page-title">✅ 待办任务</h1>

      <div class="card" style="margin-bottom: 14px;">
        <form id="task-form" class="form-row" autocomplete="off">
          <input name="title" class="input grow" placeholder="任务标题，例如：完成周报…" required>
          <select name="priority" class="select" title="优先级">
            <option value="high">高优先级</option>
            <option value="mid" selected>中优先级</option>
            <option value="low">低优先级</option>
          </select>
          <input type="date" name="dueDate" class="input" title="截止日期">
          <input name="project" class="input" list="project-list" placeholder="项目/分类" title="所属项目">
          <datalist id="project-list">${projects.map(p => `<option value="${Worktable.escapeHtml(p)}">`).join('')}</datalist>
          <button type="submit" class="btn btn-primary" id="task-submit">添加任务</button>
          <button type="button" class="btn hidden" id="task-cancel">取消编辑</button>
        </form>
      </div>

      <div class="card">
        <div class="task-toolbar">
          <input id="task-search" class="input grow" placeholder="🔍 搜索任务标题或项目…" value="${Worktable.escapeHtml(search)}">
          <select id="task-status" class="select">
            <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>全部状态</option>
            <option value="active" ${statusFilter === 'active' ? 'selected' : ''}>进行中</option>
            <option value="done" ${statusFilter === 'done' ? 'selected' : ''}>已完成</option>
          </select>
          <select id="task-project" class="select">
            <option value="">全部项目</option>
            ${projects.map(p => `<option value="${Worktable.escapeHtml(p)}" ${projectFilter === p ? 'selected' : ''}>${Worktable.escapeHtml(p)}</option>`).join('')}
          </select>
          <span id="task-count" style="color: var(--text-secondary); font-size: 13px;"></span>
        </div>
        <div id="task-list"></div>
      </div>
    `;

    // 编辑模式：预填表单
    if (editing) {
      el.querySelector('#task-form').title.value = editing.title;
      el.querySelector('#task-form').priority.value = editing.priority || 'mid';
      el.querySelector('#task-form').dueDate.value = editing.dueDate || '';
      el.querySelector('#task-form').project.value = editing.project || '';
      el.querySelector('#task-submit').textContent = '保存修改';
      el.querySelector('#task-cancel').classList.remove('hidden');
    }

    renderList();
  }

  function startEdit(id) {
    editingId = id;
    render();
    el.querySelector('#task-form').title.focus();
  }

  function cancelEdit() {
    editingId = null;
    render();
  }

  function init() {
    // 提交表单：新增或保存修改
    el.addEventListener('submit', function (e) {
      const form = e.target.closest('#task-form');
      if (!form) return;
      e.preventDefault();
      const title = form.title.value.trim();
      if (!title) { Worktable.toast('任务标题不能为空'); return; }

      const now = new Date().toISOString();
      if (editingId) {
        const task = Worktable.data.tasks.find(t => t.id === editingId);
        if (task) {
          task.title = title;
          task.priority = form.priority.value;
          task.dueDate = form.dueDate.value || '';
          task.project = form.project.value.trim();
        }
        editingId = null;
        Worktable.toast('已保存修改');
      } else {
        Worktable.data.tasks.push({
          id: Worktable.uid(),
          title: title,
          priority: form.priority.value,
          dueDate: form.dueDate.value || '',
          project: form.project.value.trim(),
          done: false,
          createdAt: now
        });
        Worktable.toast('已添加任务');
      }
      Worktable.saveData();
      render();
    });

    // 取消编辑
    el.addEventListener('click', function (e) {
      if (e.target.closest('#task-cancel')) cancelEdit();
    });

    // 任务行操作：编辑 / 删除
    el.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === 'edit') {
        startEdit(id);
      } else if (btn.dataset.act === 'del') {
        const task = Worktable.data.tasks.find(t => t.id === id);
        if (task && confirm('确定要删除任务「' + task.title + '」吗？')) {
          Worktable.data.tasks = Worktable.data.tasks.filter(t => t.id !== id);
          if (editingId === id) editingId = null;
          Worktable.saveData();
          render();
          Worktable.toast('已删除');
        }
      }
    });

    // 完成切换
    el.addEventListener('change', function (e) {
      if (e.target.classList.contains('task-checkbox')) {
        const task = Worktable.data.tasks.find(t => t.id === e.target.dataset.taskId);
        if (task) {
          Worktable.setTaskDone(task, e.target.checked);
          Worktable.saveData();
          renderList();
        }
      }
    });

    // 搜索（只重建列表，保持输入焦点）
    el.addEventListener('input', function (e) {
      if (e.target.id === 'task-search') {
        search = e.target.value;
        renderList();
      }
    });

    // 状态 / 项目筛选
    el.addEventListener('change', function (e) {
      if (e.target.id === 'task-status') {
        statusFilter = e.target.value;
        renderList();
      } else if (e.target.id === 'task-project') {
        projectFilter = e.target.value;
        renderList();
      }
    });
  }

  Worktable.register(viewId, { init: init, render: render });
  init();
})();
