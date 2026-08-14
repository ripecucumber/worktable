/* ============================================================
   review.js — 每日回顾
   按天查看：待办完成率（按时/逾期/未完成，逾期完成计入完成率）、
   当天新建的笔记/书签、当天日程；
   月热力图：每天完成任务数 / 新建笔记数（可翻页浏览每月，补满整周），
   点击当月格子可跳转到那一天
   ============================================================ */

(function () {
  const viewId = 'review';
  const el = document.getElementById('view-' + viewId);

  // 界面状态
  let viewDate = Worktable.today(); // 回顾的日期 YYYY-MM-DD
  const now = new Date();
  let heatYear = now.getFullYear();  // 热力图显示的年份
  let heatMonth = now.getMonth();    // 热力图显示的月份（0-11）

  /** 生成某月热力图的周列（补满整周，含相邻月日期） */
  function heatmapMonthWeeks(year, month) {
    const first = new Date(year, month, 1);
    const firstOffset = (first.getDay() + 6) % 7; // 当月 1 号是周几（周一起算）
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const start = new Date(first);
    start.setDate(1 - firstOffset); // 起始格：1 号所在周的周一
    const weeks = Math.ceil((firstOffset + daysInMonth) / 7);
    const cols = [];
    for (let w = 0; w < weeks; w++) {
      const col = [];
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setDate(start.getDate() + w * 7 + d);
        col.push({ date: Worktable.iso(day), inMonth: day.getMonth() === month && day.getFullYear() === year });
      }
      cols.push(col);
    }
    return cols;
  }

  /** 统计每天数量：items 按 keyFn 得到日期，返回 { 'YYYY-MM-DD': 数量 } */
  function countMap(items, keyFn) {
    const map = {};
    items.forEach(function (it) {
      const d = keyFn(it);
      if (d) map[d] = (map[d] || 0) + 1;
    });
    return map;
  }

  /** 数量 → 色阶 0-4 */
  function heatLevel(count) {
    if (count <= 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 9) return 3;
    return 4;
  }

  /** 渲染一张月热力图网格（不含导航与图例，由卡片统一提供） */
  function renderHeatmapGrid(counts, label) {
    const cols = heatmapMonthWeeks(heatYear, heatMonth);
    return `
        <div class="heatmap">
          <div class="heatmap-weekdays">
            <span>一</span><span></span><span></span><span></span><span></span><span></span><span>日</span>
          </div>
          ${cols.map(function (col) {
            return '<div class="heatmap-col">' + col.map(function (c) {
              if (!c.inMonth) {
                return '<div class="heatmap-cell other-month"></div>';
              }
              const count = counts[c.date] || 0;
              return `<div class="heatmap-cell l${heatLevel(count)}" data-heat-date="${c.date}"
                        title="${Worktable.formatDate(c.date)}：${count} ${label}${count ? '' : '（点击查看当天）'}"></div>`;
            }).join('') + '</div>';
          }).join('')}
        </div>`;
  }

  /** 逾期完成的天数（completedAt 本地日期 - dueDate） */
  function lateDays(task) {
    const done = Worktable.localDateOf(task.completedAt);
    const due = new Date(task.dueDate + 'T00:00:00');
    const doneD = new Date(done + 'T00:00:00');
    return Math.round((doneD - due) / 86400000);
  }

  function render() {
    const date = viewDate;
    const week = ['日', '一', '二', '三', '四', '五', '六'];
    const d = new Date(date + 'T00:00:00');
    const dateLabel = isNaN(d.getTime()) ? date : (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + week[d.getDay()];

    // —— 统计 ——
    const createdTasks = Worktable.data.tasks.filter(t => Worktable.localDateOf(t.createdAt) === date);
    const completedTasks = Worktable.data.tasks.filter(t => Worktable.localDateOf(t.completedAt) === date);
    const createdNotes = Worktable.data.notes.filter(n => Worktable.localDateOf(n.createdAt) === date);
    const createdBookmarks = Worktable.data.bookmarks.filter(b => Worktable.localDateOf(b.createdAt) === date);
    const dayEvents = Worktable.data.events.filter(e => e.date === date).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

    // —— 待办完成率：按"当天到期"统计（逾期完成也计入完成率）——
    const dueTasks = Worktable.data.tasks.filter(t => t.dueDate === date);
    const onTimeTasks = dueTasks.filter(t => t.done && Worktable.localDateOf(t.completedAt) <= t.dueDate);
    const lateTasks = dueTasks.filter(t => t.done && Worktable.localDateOf(t.completedAt) > t.dueDate);
    const notDoneTasks = dueTasks.filter(t => !t.done);
    const doneTotal = onTimeTasks.length + lateTasks.length;
    const rate = dueTasks.length ? Math.round(doneTotal / dueTasks.length * 100) : 0;

    // 到期任务排序：未完成在前（按优先级），已完成在后
    const PRIORITY = { high: 0, mid: 1, low: 2 };
    const sortedDue = dueTasks.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ap = PRIORITY[a.priority] != null ? PRIORITY[a.priority] : 2;
      const bp = PRIORITY[b.priority] != null ? PRIORITY[b.priority] : 2;
      return ap - bp;
    });
    const taskLabel = { high: '高', mid: '中', low: '低' };

    // —— 热力图数据 ——
    const doneMap = countMap(Worktable.data.tasks, t => Worktable.localDateOf(t.completedAt));
    const notesMap = countMap(Worktable.data.notes, n => Worktable.localDateOf(n.createdAt));

    el.innerHTML = `
      <h1 class="page-title">📈 每日回顾</h1>

      <div class="card review-nav" style="margin-bottom: 14px;">
        <button type="button" class="icon-btn" data-rv="prev" title="前一天">◀</button>
        <span class="cal-title" style="flex:none;">${dateLabel}</span>
        <button type="button" class="icon-btn" data-rv="next" title="后一天">▶</button>
        <button type="button" class="btn btn-sm" data-rv="today">今天</button>
        <span style="flex:1"></span>
        <input type="date" id="review-date" class="input" value="${date}" title="选择日期">
        <button type="button" class="btn btn-sm btn-primary" data-rv="jump">查看这天</button>
      </div>

      <div class="dash-grid">
        <!-- 待办完成率（含逾期完成） -->
        <div class="card">
          <h3>✅ 待办完成率</h3>
          ${dueTasks.length === 0 && createdTasks.length === 0
            ? '<div class="empty">这天没有到期待办或待办记录</div>'
            : `
              <div style="font-size:13px;color:var(--text-secondary);margin-bottom:6px;">
                当天到期 <b>${dueTasks.length}</b> 条 · 按时完成 <b>${onTimeTasks.length}</b> · 逾期完成 <b>${lateTasks.length}</b> · 未完成 <b>${notDoneTasks.length}</b>
              </div>
              ${dueTasks.length ? `
                <div class="progress"><div style="width:${rate}%"></div></div>
                <div style="font-size:13px;color:var(--text-secondary);">完成率 <b>${rate}%</b>（逾期完成计入）</div>` : ''}
              <div style="margin-top:10px;">
                ${dueTasks.length === 0 ? '' : sortedDue.map(t => {
                  let statusBadge = '';
                  if (!t.done) statusBadge = '<span class="badge badge-tag">⬜ 未完成</span>';
                  else if (Worktable.localDateOf(t.completedAt) <= t.dueDate) statusBadge = '<span class="badge badge-success">✅ 按时完成</span>';
                  else statusBadge = '<span class="badge badge-mid">⏰ 逾期 ' + lateDays(t) + ' 天完成</span>';
                  return `
                    <div class="dash-item ${t.done ? 'done' : ''}">
                      <input type="checkbox" class="task-checkbox" data-task-id="${t.id}" ${t.done ? 'checked' : ''}>
                      <span class="dash-title">${Worktable.escapeHtml(t.title)}</span>
                      <span class="badge badge-${t.priority || 'low'}">${taskLabel[t.priority] || '低'}优先级</span>
                      ${statusBadge}
                    </div>`;
                }).join('')}
                ${createdTasks.length || completedTasks.length ? `
                  <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;">
                    补充：当天新增 ${createdTasks.length} 条 · 当天完成 ${completedTasks.length} 条
                  </div>` : ''}
              </div>`}
        </div>

        <!-- 笔记 -->
        <div class="card">
          <h3>📝 新建笔记 <span class="badge badge-project" style="cursor:pointer" data-goto="notes">查看 →</span></h3>
          ${createdNotes.length === 0
            ? '<div class="empty">这天没有新建笔记</div>'
            : createdNotes.map(n => `
                <div class="dash-item">
                  <span>${n.type === 'code' ? '💻' : '📝'}</span>
                  <span class="dash-title">${Worktable.escapeHtml(n.title || '（无标题）')}</span>
                </div>`).join('')}
        </div>

        <!-- 书签 -->
        <div class="card">
          <h3>🔖 收藏书签 <span class="badge badge-project" style="cursor:pointer" data-goto="bookmarks">查看 →</span></h3>
          ${createdBookmarks.length === 0
            ? '<div class="empty">这天没有收藏书签</div>'
            : createdBookmarks.map(b => `
                <div class="dash-item">
                  <span>🔗</span>
                  <a class="dash-title" href="${Worktable.escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">${Worktable.escapeHtml(b.title || b.url)}</a>
                </div>`).join('')}
        </div>

        <!-- 日程 -->
        <div class="card">
          <h3>📅 当天日程 <span class="badge badge-project" style="cursor:pointer" data-goto="calendar">查看 →</span></h3>
          ${dayEvents.length === 0
            ? '<div class="empty">这天没有日程</div>'
            : dayEvents.map(e => `
                <div class="dash-item">
                  <span class="badge badge-project">${Worktable.escapeHtml(e.time || '全天')}</span>
                  <span class="dash-title">${Worktable.escapeHtml(e.title)}</span>
                </div>`).join('')}
        </div>

        <!-- 热力图：待办完成（与其他卡片同网格对齐） -->
        <div class="card heatmap-card">
          <div class="heatmap-card-head">
            <h3 style="margin:0;">🔥 待办完成 <span style="font-size:12px;color:var(--text-secondary);font-weight:400;">每天完成数</span></h3>
            <div class="heatmap-nav">
              <button type="button" class="icon-btn" data-heat-nav="prev" title="上个月">◀</button>
              <span class="heatmap-title">${heatYear}年${heatMonth + 1}月</span>
              <button type="button" class="icon-btn" data-heat-nav="next" title="下个月">▶</button>
              <button type="button" class="btn btn-sm" data-heat-nav="today">本月</button>
            </div>
          </div>
          ${renderHeatmapGrid(doneMap, '个任务')}
          <div class="heatmap-legend">少
            <span class="heatmap-cell l1"></span>
            <span class="heatmap-cell l2"></span>
            <span class="heatmap-cell l3"></span>
            <span class="heatmap-cell l4"></span>
            多 · 点击格子查看那一天
          </div>
        </div>

        <!-- 热力图：新建笔记 -->
        <div class="card heatmap-card">
          <div class="heatmap-card-head">
            <h3 style="margin:0;">🔥 新建笔记 <span style="font-size:12px;color:var(--text-secondary);font-weight:400;">每天新建数</span></h3>
            <div class="heatmap-nav">
              <button type="button" class="icon-btn" data-heat-nav="prev" title="上个月">◀</button>
              <span class="heatmap-title">${heatYear}年${heatMonth + 1}月</span>
              <button type="button" class="icon-btn" data-heat-nav="next" title="下个月">▶</button>
              <button type="button" class="btn btn-sm" data-heat-nav="today">本月</button>
            </div>
          </div>
          ${renderHeatmapGrid(notesMap, '条笔记')}
          <div class="heatmap-legend">少
            <span class="heatmap-cell l1"></span>
            <span class="heatmap-cell l2"></span>
            <span class="heatmap-cell l3"></span>
            <span class="heatmap-cell l4"></span>
            多 · 点击格子查看那一天
          </div>
        </div>
      </div>
    `;
  }

  /** 日期加减天 */
  function shiftDate(days) {
    const dt = new Date(viewDate + 'T00:00:00');
    dt.setDate(dt.getDate() + days);
    viewDate = Worktable.iso(dt);
  }

  /** 热力图翻页 */
  function shiftHeatMonth(delta) {
    heatMonth += delta;
    if (heatMonth < 0) { heatMonth = 11; heatYear--; }
    if (heatMonth > 11) { heatMonth = 0; heatYear++; }
  }

  function init() {
    // 日期导航
    el.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-rv]');
      if (btn) {
        const act = btn.dataset.rv;
        if (act === 'prev') shiftDate(-1);
        else if (act === 'next') shiftDate(1);
        else if (act === 'today') viewDate = Worktable.today();
        else if (act === 'jump') {
          const input = document.getElementById('review-date');
          if (input && input.value) viewDate = input.value;
        }
        render();
        return;
      }

      // 热力图翻页
      const navBtn = e.target.closest('[data-heat-nav]');
      if (navBtn) {
        const act = navBtn.dataset.heatNav;
        if (act === 'prev') shiftHeatMonth(-1);
        else if (act === 'next') shiftHeatMonth(1);
        else if (act === 'today') {
          const t = new Date();
          heatYear = t.getFullYear();
          heatMonth = t.getMonth();
        }
        render();
        return;
      }

      // 点击热力图格子 → 跳转到那一天
      const cell = e.target.closest('[data-heat-date]');
      if (cell) {
        viewDate = cell.dataset.heatDate;
        render();
      }
    });

    // 勾选完成当天任务
    el.addEventListener('change', function (e) {
      if (e.target.classList.contains('task-checkbox')) {
        const task = Worktable.data.tasks.find(t => t.id === e.target.dataset.taskId);
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
