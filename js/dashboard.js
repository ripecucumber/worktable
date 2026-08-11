/* ============================================================
   dashboard.js — 仪表盘：一打开工作台看到全貌
   今日待办 / 今日日程 / 最近笔记 / 最近书签 / 任务完成率
   ============================================================ */

(function () {
  const viewId = 'dashboard';
  const el = document.getElementById('view-' + viewId);

  function render() {
    const data = Worktable.data;
    const today = Worktable.today();

    // —— 今日待办：未完成且截止日期在今天或已逾期 ——
    const todayTasks = data.tasks.filter(t => !t.done && t.dueDate && t.dueDate <= today);

    // —— 今日日程 ——
    const todayEvents = data.events
      .filter(e => e.date === today)
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    // —— 最近笔记（按更新时间倒序）——
    const recentNotes = data.notes
      .slice()
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .slice(0, 5);

    // —— 最近书签（按创建时间倒序）——
    const recentBookmarks = data.bookmarks
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 5);

    // —— 完成率 ——
    const doneCount = data.tasks.filter(t => t.done).length;
    const totalCount = data.tasks.length;
    const percent = totalCount ? Math.round(doneCount / totalCount * 100) : 0;

    // —— 问候语 ——
    const h = new Date().getHours();
    const greet = h < 6 ? '夜深了，注意休息' : h < 12 ? '早上好' : h < 18 ? '下午好' : '晚上好';
    const week = ['日', '一', '二', '三', '四', '五', '六'];
    const now = new Date();
    const dateStr = (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' + week[now.getDay()];

    el.innerHTML = `
      <h1 class="page-title">📊 ${dateStr} · ${greet}</h1>

      <div class="dash-quick">
        <button type="button" class="btn btn-primary" data-goto="tasks">➕ 添加待办</button>
        <button type="button" class="btn" data-goto="notes">✏️ 新建笔记</button>
        <button type="button" class="btn" data-goto="bookmarks">🔖 收藏链接</button>
        <button type="button" class="btn" data-goto="calendar">📅 查看日历</button>
      </div>

      <div class="dash-stats">
        <div class="stat-card"><div class="stat-num">${todayTasks.length}</div><div class="stat-label">今日待办（含逾期）</div></div>
        <div class="stat-card"><div class="stat-num">${data.tasks.filter(t => !t.done).length}</div><div class="stat-label">未完成待办</div></div>
        <div class="stat-card"><div class="stat-num">${data.notes.length}</div><div class="stat-label">笔记 / 代码片段</div></div>
        <div class="stat-card"><div class="stat-num">${data.bookmarks.length}</div><div class="stat-label">收藏书签</div></div>
      </div>

      <div class="dash-grid">
        <div class="card">
          <h3>✅ 今日待办 <span class="badge badge-project" style="cursor:pointer" data-goto="tasks">查看全部 →</span></h3>
          ${todayTasks.length === 0
            ? '<div class="empty">今天没有到期任务，干得漂亮 🎉</div>'
            : todayTasks.map(t => `
                <div class="dash-item">
                  <input type="checkbox" class="task-checkbox" data-task-id="${t.id}" ${t.done ? 'checked' : ''}>
                  <span class="dash-title">${Worktable.escapeHtml(t.title)}</span>
                  <span class="badge ${t.dueDate < today ? 'badge-overdue' : 'badge-mid'}">${Worktable.relativeDue(t.dueDate)}</span>
                </div>`).join('')}
        </div>

        <div class="card">
          <h3>📅 今日日程 <span class="badge badge-project" style="cursor:pointer" data-goto="calendar">查看全部 →</span></h3>
          ${todayEvents.length === 0
            ? '<div class="empty">今天暂无日程安排</div>'
            : todayEvents.map(e => `
                <div class="dash-item">
                  <span class="badge badge-project">${Worktable.escapeHtml(e.time || '全天')}</span>
                  <span class="dash-title">${Worktable.escapeHtml(e.title)}</span>
                </div>`).join('')}
        </div>

        <div class="card">
          <h3>📝 最近笔记 <span class="badge badge-project" style="cursor:pointer" data-goto="notes">更多 →</span></h3>
          ${recentNotes.length === 0
            ? '<div class="empty">还没有笔记，去记一条吧</div>'
            : recentNotes.map(n => `
                <div class="dash-item">
                  <span>${n.type === 'code' ? '💻' : '📝'}</span>
                  <span class="dash-title">${Worktable.escapeHtml(n.title || '（无标题）')}</span>
                  <span class="badge badge-tag">${Worktable.escapeHtml((n.updatedAt || '').slice(5).replace('-', '/'))}</span>
                </div>`).join('')}
        </div>

        <div class="card">
          <h3>🔖 最近书签 <span class="badge badge-project" style="cursor:pointer" data-goto="bookmarks">更多 →</span></h3>
          ${recentBookmarks.length === 0
            ? '<div class="empty">还没有收藏，看到好文章就存进来</div>'
            : recentBookmarks.map(b => `
                <div class="dash-item">
                  <span>🔗</span>
                  <a class="dash-title" href="${Worktable.escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${Worktable.escapeHtml(b.title || b.url)}</a>
                </div>`).join('')}
        </div>

        <div class="card" style="grid-column: 1 / -1;">
          <h3>📈 任务完成率</h3>
          ${totalCount === 0
            ? '<div class="empty">还没有任务，先从添加一条待办开始吧</div>'
            : `
              <div class="progress"><div style="width: ${percent}%"></div></div>
              <div style="color: var(--text-secondary); font-size: 13px;">
                已完成 <b>${doneCount}</b> / 共 <b>${totalCount}</b> 项 · 完成率 <b>${percent}%</b>
              </div>`}
        </div>
      </div>
    `;
  }

  function init() {
    // 事件委托：勾选完成今日待办
    el.addEventListener('change', function (e) {
      if (e.target.classList.contains('task-checkbox')) {
        const id = e.target.dataset.taskId;
        const task = Worktable.data.tasks.find(t => t.id === id);
        if (task) {
          Worktable.setTaskDone(task, e.target.checked);
          Worktable.saveData();
          render();
        }
      }
    });
  }

  Worktable.register(viewId, { init: init, render: render });
  init();
})();
