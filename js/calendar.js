/* ============================================================
   calendar.js — 日历日程
   月视图（周一开头）、点击日期添加/编辑/删除日程、
   显示当天到期的待办任务徽标、可勾选完成
   ============================================================ */

(function () {
  const viewId = 'calendar';
  const el = document.getElementById('view-' + viewId);

  // 界面状态
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();            // 0-11
  let selectedDate = Worktable.today();  // YYYY-MM-DD
  let editingEventId = null;

  function monthKey() {
    return year + '-' + String(month + 1).padStart(2, '0');
  }

  /** 某天的日程（按时间排序，无时间的排在最后） */
  function eventsOf(date) {
    return Worktable.data.events
      .filter(e => e.date === date)
      .sort((a, b) => {
        const at = a.time || '99:99', bt = b.time || '99:99';
        return at.localeCompare(bt);
      });
  }

  /** 某天事项中的待办：当天到期全部（含已完成）+ 逾期未完成（详情面板展示用，历史已完成不显示） */
  function tasksOf(date) {
    return Worktable.data.tasks.filter(t => t.dueDate && t.dueDate <= date && (t.dueDate === date || !t.done));
  }

  /** 某天到期或已逾期且未完成的待办（日历格子徽标用，按到期日排序） */
  function tasksDueOf(date) {
    return Worktable.data.tasks
      .filter(t => t.dueDate && t.dueDate <= date && !t.done)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  }

  /** 月视图网格 */
  function cells() {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;            // 周一开头
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const total = Math.ceil((offset + daysInMonth) / 7) * 7;
    const today = Worktable.today();
    const mk = monthKey();

    let html = '';
    for (let i = 0; i < total; i++) {
      let d, dateStr;
      if (i < offset) {
        d = prevDays - offset + i + 1;
        dateStr = Worktable.iso(new Date(year, month - 1, d));
      } else if (i >= offset + daysInMonth) {
        d = i - offset - daysInMonth + 1;
        dateStr = Worktable.iso(new Date(year, month + 1, d));
      } else {
        d = i - offset + 1;
        dateStr = Worktable.iso(new Date(year, month, d));
      }

      let cls = 'cal-day';
      if (!dateStr.startsWith(mk)) cls += ' other-month';
      if (dateStr === today) cls += ' today';
      if (dateStr === selectedDate) cls += ' selected';

      const evs = eventsOf(dateStr);
      const tasks = tasksDueOf(dateStr);
      const shown = evs.slice(0, 2);
      const shownTasks = tasks.slice(0, 1);
      const more = evs.length + tasks.length - shown.length - shownTasks.length;

      html += `<div class="${cls}" data-date="${dateStr}" title="${Worktable.formatDate(dateStr)}">
        <span class="cal-date">${d}</span>
        ${shown.map(e => `<div class="cal-event ${e.done ? 'done' : ''}" title="${Worktable.escapeHtml(e.title)}">${Worktable.escapeHtml(e.time ? e.time + ' ' : '')}${Worktable.escapeHtml(e.title)}</div>`).join('')}
        ${shownTasks.map(t => `
          <label class="cal-task ${t.dueDate < dateStr ? 'overdue' : ''}" title="${Worktable.escapeHtml(t.title)}${t.dueDate < dateStr ? '（逾期）' : ''}">
            <input type="checkbox" class="task-checkbox cal-task-check" data-task-id="${t.id}" onclick="event.stopPropagation()">
            ${Worktable.escapeHtml(t.title)}
          </label>`).join('')}
        ${more > 0 ? `<div class="cal-more">+${more} 更多</div>` : ''}
      </div>`;
    }
    return html;
  }

  /** 右侧详情面板：当天事项（日程与待办合并展示） */
  function renderSide() {
    const evs = eventsOf(selectedDate);
    const tasks = tasksOf(selectedDate);
    const editing = editingEventId ? Worktable.data.events.find(e => e.id === editingEventId) : null;

    // 待办排序：未完成在前（按优先级），已完成在后
    const PRIORITY = { high: 0, mid: 1, low: 2 };
    const sortedTasks = tasks.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const ap = PRIORITY[a.priority] != null ? PRIORITY[a.priority] : 2;
      const bp = PRIORITY[b.priority] != null ? PRIORITY[b.priority] : 2;
      return ap - bp;
    });
    const taskLabel = { high: '高', mid: '中', low: '低' };
    const hasItems = evs.length > 0 || tasks.length > 0;

    // 逾期天数（当前查看日期 - 到期日）
    const overdueOf = function (t) {
      const due = new Date(t.dueDate + 'T00:00:00');
      const cur = new Date(selectedDate + 'T00:00:00');
      return Math.round((cur - due) / 86400000);
    };

    document.getElementById('cal-side').innerHTML = `
      <div class="card">
        <h3>📌 ${Worktable.formatDate(selectedDate)}</h3>

        <form id="event-form" class="form-col" autocomplete="off" style="margin-bottom: 8px;">
          <div class="form-row">
            <input name="title" class="input grow" placeholder="日程标题…" required value="${Worktable.escapeHtml(editing ? editing.title : '')}">
            <input type="time" name="time" class="input" title="时间（可选）" value="${Worktable.escapeHtml(editing ? editing.time : '')}">
            <button type="submit" class="btn btn-primary">${editingEventId ? '保存修改' : '添加'}</button>
            <button type="button" class="btn ${editingEventId ? '' : 'hidden'}" data-act="cancel-event">取消</button>
          </div>
          <input name="desc" class="input" placeholder="说明（可选）" value="${Worktable.escapeHtml(editing ? editing.description : '')}">
        </form>

        <h4>📋 当天事项</h4>
        ${!hasItems
          ? '<div class="empty">这一天没有日程或到期待办</div>'
          : evs.map(e => `
              <div class="dash-item ${e.done ? 'done' : ''}">
                <input type="checkbox" class="event-checkbox" data-event-id="${e.id}" ${e.done ? 'checked' : ''} title="标记完成">
                <span class="event-time">${Worktable.escapeHtml(e.time || '全天')}</span>
                <div class="event-body">
                  <div class="event-title">${Worktable.escapeHtml(e.title)}</div>
                  ${e.description ? `<div class="event-desc">${Worktable.escapeHtml(e.description)}</div>` : ''}
                </div>
                <div class="task-actions">
                  <button type="button" class="icon-btn" data-act="edit-event" data-id="${e.id}" title="编辑">✏️</button>
                  <button type="button" class="icon-btn" data-act="del-event" data-id="${e.id}" title="删除">🗑️</button>
                </div>
              </div>`).join('')
            + sortedTasks.map(t => `
              <div class="dash-item ${t.done ? 'done' : ''}">
                <input type="checkbox" class="task-checkbox" data-task-id="${t.id}" ${t.done ? 'checked' : ''}>
                <span class="dash-title">${Worktable.escapeHtml(t.title)}</span>
                <span class="badge badge-${t.priority || 'low'}">${taskLabel[t.priority] || '低'}优先级</span>
                ${!t.done && t.dueDate < selectedDate ? `<span class="badge badge-overdue">⏰ 逾期 ${overdueOf(t)} 天</span>` : ''}
                ${t.done ? '<span class="badge badge-success">已完成</span>' : ''}
              </div>`).join('')}
      </div>
    `;
  }

  function render() {
    el.innerHTML = `
      <h1 class="page-title">📅 日历</h1>
      <div class="cal-layout">
        <div class="card">
          <div class="cal-header">
            <button type="button" class="icon-btn" data-cal="prev" title="上个月">◀</button>
            <span class="cal-title">${year}年${month + 1}月</span>
            <button type="button" class="icon-btn" data-cal="next" title="下个月">▶</button>
            <button type="button" class="btn btn-sm" data-cal="today">今天</button>
            <span style="flex:1"></span>
            <input type="date" id="cal-jump" class="input" value="${selectedDate}" title="跳到某一天">
            <button type="button" class="btn btn-sm btn-primary" data-cal="jump">跳转</button>
          </div>
          <div class="cal-grid">
            ${['一', '二', '三', '四', '五', '六', '日'].map(w => `<div class="cal-weekday">${w}</div>`).join('')}
            ${cells()}
          </div>
        </div>
        <div id="cal-side"></div>
      </div>
    `;
    renderSide();
  }

  function startEditEvent(id) {
    editingEventId = id;
    renderSide();
  }

  function init() {
    // 切换月份 / 回到今天
    el.addEventListener('click', function (e) {
      const cal = e.target.closest('[data-cal]');
      if (cal) {
        const act = cal.dataset.cal;
        if (act === 'prev') { month--; if (month < 0) { month = 11; year--; } }
        else if (act === 'next') { month++; if (month > 11) { month = 0; year++; } }
        else if (act === 'today') {
          const t = new Date();
          year = t.getFullYear(); month = t.getMonth();
          selectedDate = Worktable.today();
        }
        else if (act === 'jump') {
          const jumpInput = document.getElementById('cal-jump');
          const target = jumpInput ? jumpInput.value : '';
          if (target) {
            const dt = new Date(target + 'T00:00:00');
            if (!isNaN(dt.getTime())) {
              year = dt.getFullYear();
              month = dt.getMonth();
              selectedDate = target;
            }
          }
        }
        editingEventId = null;
        render();
        return;
      }

      // 点击某一天
      const day = e.target.closest('.cal-day');
      if (day) {
        selectedDate = day.dataset.date;
        editingEventId = null;
        // 点击相邻月份的日子时，自动切换到那个月
        if (!selectedDate.startsWith(monthKey())) {
          const dt = new Date(selectedDate + 'T00:00:00');
          year = dt.getFullYear();
          month = dt.getMonth();
        }
        render();
        return;
      }

      // 日程操作：编辑 / 删除 / 取消
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === 'edit-event') { startEditEvent(id); return; }
      if (btn.dataset.act === 'cancel-event') { editingEventId = null; renderSide(); return; }
      if (btn.dataset.act === 'del-event') {
        const ev = Worktable.data.events.find(x => x.id === id);
        if (ev && confirm('确定要删除日程「' + ev.title + '」吗？')) {
          Worktable.data.events = Worktable.data.events.filter(x => x.id !== id);
          if (editingEventId === id) editingEventId = null;
          Worktable.saveData();
          render();
          Worktable.toast('已删除');
        }
      }
    });

    // 添加 / 保存日程
    el.addEventListener('submit', function (e) {
      const form = e.target.closest('#event-form');
      if (!form) return;
      e.preventDefault();
      const title = form.title.value.trim();
      if (!title) { Worktable.toast('日程标题不能为空'); return; }

      if (editingEventId) {
        const ev = Worktable.data.events.find(x => x.id === editingEventId);
        if (ev) {
          ev.title = title;
          ev.time = form.time.value || '';
          ev.description = form.desc.value.trim();
        }
        editingEventId = null;
        Worktable.toast('已保存修改');
      } else {
        Worktable.data.events.push({
          id: Worktable.uid(),
          title: title,
          date: selectedDate,
          time: form.time.value || '',
          description: form.desc.value.trim(),
          done: false,
          createdAt: new Date().toISOString()
        });
        Worktable.toast('已添加日程');
      }
      Worktable.saveData();
      render();
    });

    // 勾选完成任务 / 标记日程完成（相互独立）
    el.addEventListener('change', function (e) {
      if (e.target.classList.contains('task-checkbox')) {
        const task = Worktable.data.tasks.find(t => t.id === e.target.dataset.taskId);
        if (task) {
          Worktable.setTaskDone(task, e.target.checked);
          Worktable.saveData();
          render();
        }
      } else if (e.target.classList.contains('event-checkbox')) {
        const ev = Worktable.data.events.find(x => x.id === e.target.dataset.eventId);
        if (ev) {
          ev.done = e.target.checked;
          Worktable.saveData();
          render();
        }
      }
    });
  }

  Worktable.register(viewId, { init: init, render: render });
  init();
})();
