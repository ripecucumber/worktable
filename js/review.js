/* ============================================================
   review.js — 每日回顾
   按天查看：学习记录（学了什么 + 时长，内置计时器自动生成记录）、
   待办完成率、当天新建的笔记/书签、当天日程
   ============================================================ */

(function () {
  const viewId = 'review';
  const el = document.getElementById('view-' + viewId);

  // 界面状态
  let viewDate = Worktable.today(); // 回顾的日期 YYYY-MM-DD
  let editingRecordId = null;       // 正在编辑的学习记录 id
  // 学习计时器（内存状态，刷新后停止；结束时生成一条学习记录）
  let timer = { running: false, startTs: 0, pendingSeconds: 0, date: '', subject: '' };
  let timerInterval = null;

  /** 秒 → "X小时Y分钟Z秒" 友好显示 */
  function fmtDuration(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const parts = [];
    if (h) parts.push(h + '小时');
    if (m) parts.push(m + '分钟');
    if (s) parts.push(s + '秒');
    return parts.length ? parts.join('') : '0秒';
  }

  /** 分钟 → "X小时Y分钟" */
  function fmtMinutes(minutes) {
    minutes = Math.max(0, Math.floor(minutes));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return (h ? h + '小时' : '') + m + '分钟';
  }

  /** 某天的学习记录（按创建时间排序） */
  function recordsOf(date) {
    return Worktable.data.studyRecords
      .filter(r => r.date === date)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  }

  /** 某天学习总时长（分钟） */
  function totalMinutes(date) {
    return recordsOf(date).reduce((sum, r) => sum + (r.minutes || 0), 0);
  }

  /** 更新计时器显示（不重建页面）：当天已记录时长 + 本次会话进行中的时长 */
  function updateTimerDisplay() {
    const disp = document.getElementById('timer-display');
    if (!disp) return;
    const elapsed = timer.running
      ? timer.pendingSeconds + Math.floor((Date.now() - timer.startTs) / 1000)
      : timer.pendingSeconds;
    // 有进行中的会话（计时中或未结束）时统计会话所在日期，否则统计当前查看的日期
    const hasSession = timer.running || timer.pendingSeconds > 0;
    const baseDate = hasSession ? (timer.date || viewDate) : viewDate;
    const total = totalMinutes(baseDate) * 60 + elapsed;
    disp.textContent = fmtDuration(total);
  }

  /** 根据计时器状态启动/停止刷新 */
  function syncTimerTick() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if (timer.running) {
      timerInterval = setInterval(updateTimerDisplay, 1000);
    }
    updateTimerDisplay();
  }

  function render() {
    const date = viewDate;
    const week = ['日', '一', '二', '三', '四', '五', '六'];
    const d = new Date(date + 'T00:00:00');
    const dateLabel = isNaN(d.getTime()) ? date : (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + week[d.getDay()];

    // —— 统计 ——
    const createdTasks = Worktable.data.tasks.filter(t => (t.createdAt || '').slice(0, 10) === date);
    const completedTasks = Worktable.data.tasks.filter(t => (t.completedAt || '').slice(0, 10) === date);
    const createdNotes = Worktable.data.notes.filter(n => (n.createdAt || '').slice(0, 10) === date);
    const createdBookmarks = Worktable.data.bookmarks.filter(b => (b.createdAt || '').slice(0, 10) === date);
    const dayEvents = Worktable.data.events.filter(e => e.date === date).sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

    const doneOfCreated = createdTasks.filter(t => t.done).length;
    const rate = createdTasks.length ? Math.round(doneOfCreated / createdTasks.length * 100) : 0;
    const totalMin = totalMinutes(date);
    const dayRecords = recordsOf(date);
    const editing = editingRecordId ? Worktable.data.studyRecords.find(r => r.id === editingRecordId) : null;

    // 今天到期的未完成任务（用于展示当天安排）
    const dueTasks = Worktable.data.tasks.filter(t => t.dueDate === date && !t.done);

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
        <!-- 学习记录 -->
        <div class="card">
          <h3>⏱ 学习记录</h3>
          <div style="font-size:30px;font-weight:700;color:var(--accent-text);margin:6px 0 10px;" id="timer-display">${fmtMinutes(totalMin)}</div>

          <div class="form-row" style="margin-bottom:8px;">
            <input id="timer-subject" class="input grow" placeholder="这次学了什么？如：英语 / 数学 / 编程…" value="${Worktable.escapeHtml(timer.subject)}">
          </div>
          <div class="form-row" style="margin-bottom:12px;" id="timer-buttons">
            ${!timer.running && timer.pendingSeconds === 0
              ? `<button type="button" class="btn btn-primary" data-timer="start">▶ 开始计时</button>`
              : timer.running
                ? `<button type="button" class="btn" data-timer="pause">⏸ 暂停</button>
                   <button type="button" class="btn btn-danger" data-timer="stop">⏹ 结束并记录</button>`
                : `<button type="button" class="btn btn-primary" data-timer="resume">▶ 继续</button>
                   <button type="button" class="btn btn-danger" data-timer="stop">⏹ 结束并记录</button>`}
          </div>

          <form id="study-form" class="form-row" autocomplete="off" style="border-top:1px dashed var(--border);padding-top:12px;margin-bottom:10px;">
            <input name="subject" class="input grow" placeholder="学了什么，如：英语" required
                   value="${Worktable.escapeHtml(editing ? editing.subject : '')}">
            <input name="minutes" type="number" class="input" min="1" placeholder="分钟" required style="width:90px;"
                   value="${Worktable.escapeHtml(editing ? editing.minutes : '')}">
            <button type="submit" class="btn btn-primary">${editingRecordId ? '保存修改' : '添加记录'}</button>
            <button type="button" class="btn ${editingRecordId ? '' : 'hidden'}" data-study-act="cancel-edit">取消</button>
          </form>

          <div id="study-list">
            ${dayRecords.length === 0
              ? '<div class="empty">这一天还没有学习记录，用计时器或手动添加一条吧</div>'
              : dayRecords.map(r => `
                  <div class="dash-item">
                    <span>🎓</span>
                    <span class="dash-title">${Worktable.escapeHtml(r.subject || '学习')}</span>
                    <span class="badge badge-project">${fmtMinutes(r.minutes)}</span>
                    <button type="button" class="icon-btn" data-study-act="edit" data-id="${r.id}" title="编辑">✏️</button>
                    <button type="button" class="icon-btn" data-study-act="del" data-id="${r.id}" title="删除">🗑️</button>
                  </div>`).join('')}
          </div>
        </div>

        <!-- 待办 -->
        <div class="card">
          <h3>✅ 待办完成率</h3>
          ${createdTasks.length === 0 && completedTasks.length === 0
            ? '<div class="empty">这天没有待办记录</div>'
            : `
              <div style="font-size:13px;color:var(--text-secondary);margin-bottom:6px;">
                当天新增 <b>${createdTasks.length}</b> 条 · 当天完成 <b>${completedTasks.length}</b> 条
              </div>
              ${createdTasks.length ? `
                <div class="progress"><div style="width:${rate}%"></div></div>
                <div style="font-size:13px;color:var(--text-secondary);">新增任务完成率 <b>${rate}%</b></div>` : ''}
              <div style="margin-top:10px;">
                ${createdTasks.length === 0 ? '' : createdTasks.map(t => `
                  <div class="dash-item">
                    <input type="checkbox" class="task-checkbox" data-task-id="${t.id}" ${t.done ? 'checked' : ''}>
                    <span class="dash-title ${t.done ? 'done' : ''}">${Worktable.escapeHtml(t.title)}</span>
                  </div>`).join('')}
                ${dueTasks.length ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:8px;">当天到期未完成：</div>
                  ${dueTasks.map(t => `
                    <div class="dash-item">
                      <input type="checkbox" class="task-checkbox" data-task-id="${t.id}">
                      <span class="dash-title">${Worktable.escapeHtml(t.title)}</span>
                    </div>`).join('')}` : ''}
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
      </div>
    `;

    syncTimerTick();
  }

  /** 日期加减天 */
  function shiftDate(days) {
    const dt = new Date(viewDate + 'T00:00:00');
    dt.setDate(dt.getDate() + days);
    viewDate = Worktable.iso(dt);
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

      // 计时器按钮
      const tBtn = e.target.closest('[data-timer]');
      if (tBtn) {
        const act = tBtn.dataset.timer;
        const now = Date.now();
        if (act === 'start' || act === 'resume') {
          if (!timer.running) {
            if (act === 'start') { timer.pendingSeconds = 0; timer.date = Worktable.today(); }
            timer.startTs = now;
            timer.running = true;
          }
        } else if (act === 'pause') {
          if (timer.running) {
            timer.pendingSeconds += Math.floor((now - timer.startTs) / 1000);
            timer.running = false;
          }
        } else if (act === 'stop') {
          if (timer.running) {
            timer.pendingSeconds += Math.floor((now - timer.startTs) / 1000);
            timer.running = false;
          }
          // 结束：本次时长生成一条学习记录（主题取"这次学了什么"，默认"学习"）
          const minutes = Math.max(1, Math.round(timer.pendingSeconds / 60));
          if (minutes > 0) {
            const subjectInput = document.getElementById('timer-subject');
            if (subjectInput && subjectInput.value.trim()) timer.subject = subjectInput.value.trim();
            const subject = timer.subject || '学习';
            const recDate = timer.date || Worktable.today();
            Worktable.data.studyRecords.push({
              id: Worktable.uid(),
              date: recDate,
              subject: subject,
              minutes: minutes,
              createdAt: new Date().toISOString()
            });
            timer.pendingSeconds = 0;
            Worktable.saveData();
            Worktable.toast('已记录：' + subject + ' ' + minutes + ' 分钟');
          }
        }
        render();
        return;
      }

      // 学习记录操作：编辑 / 删除 / 取消
      const studyBtn = e.target.closest('[data-study-act]');
      if (!studyBtn) return;
      const act = studyBtn.dataset.studyAct;
      const id = studyBtn.dataset.id;
      if (act === 'cancel-edit') {
        editingRecordId = null;
        render();
      } else if (act === 'edit') {
        editingRecordId = id;
        render();
        const subjectInput = el.querySelector('#study-form [name=subject]');
        if (subjectInput) subjectInput.focus();
      } else if (act === 'del') {
        const rec = Worktable.data.studyRecords.find(r => r.id === id);
        if (rec && confirm('确定要删除这条学习记录「' + (rec.subject || '学习') + ' ' + rec.minutes + ' 分钟」吗？')) {
          Worktable.data.studyRecords = Worktable.data.studyRecords.filter(r => r.id !== id);
          if (editingRecordId === id) editingRecordId = null;
          Worktable.saveData();
          render();
          Worktable.toast('已删除');
        }
      }
    });

    // 手动添加 / 编辑学习记录
    el.addEventListener('submit', function (e) {
      const form = e.target.closest('#study-form');
      if (!form) return;
      e.preventDefault();
      const subject = form.subject.value.trim();
      const minutes = parseInt(form.minutes.value, 10);
      if (!subject) { Worktable.toast('请填写学了什么'); return; }
      if (isNaN(minutes) || minutes < 1) { Worktable.toast('请填写有效的分钟数'); return; }

      if (editingRecordId) {
        const rec = Worktable.data.studyRecords.find(r => r.id === editingRecordId);
        if (rec) {
          rec.subject = subject;
          rec.minutes = minutes;
        }
        editingRecordId = null;
        Worktable.toast('已保存修改');
      } else {
        Worktable.data.studyRecords.push({
          id: Worktable.uid(),
          date: viewDate,
          subject: subject,
          minutes: minutes,
          createdAt: new Date().toISOString()
        });
        Worktable.toast('已添加学习记录');
      }
      Worktable.saveData();
      render();
    });

    // 计时主题输入时保存到状态（避免页面重建后丢失）
    el.addEventListener('input', function (e) {
      if (e.target.id === 'timer-subject') {
        timer.subject = e.target.value;
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
