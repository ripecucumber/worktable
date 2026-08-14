/* ============================================================
   app.js — 应用入口
   1. 加载数据、应用主题
   2. 渲染侧边栏导航、切换视图
   3. 全局事件：视图跳转（data-goto）、主题快速切换
   ============================================================ */

(function () {
  // 导航配置：id 必须与 index.html 中的 <section id="view-xxx"> 对应
  const NAV = [
    { id: 'dashboard',  name: '仪表盘',    icon: '📊' },
    { id: 'tasks',      name: '待办任务',  icon: '✅' },
    { id: 'notes',      name: '笔记 & 代码', icon: '📝' },
    { id: 'bookmarks',  name: '书签收藏',  icon: '🔖' },
    { id: 'calendar',   name: '日历',      icon: '📅' },
    { id: 'projects',   name: '项目',      icon: '📦' },
    { id: 'review',     name: '每日回顾',  icon: '📈' },
    { id: 'settings',   name: '设置',      icon: '⚙️' }
  ];

  Worktable.currentView = null;

  /** 应用工作台名称（侧边栏标题 + 浏览器标签页标题） */
  Worktable.applyName = function (name) {
    const title = (name && name.trim()) || '我的工作台';
    document.title = title;
    const el = document.querySelector('.app-title');
    if (el) el.textContent = title;
  };

  /** 应用主题（浅色/深色），同步按钮文字 */
  Worktable.applyTheme = function (theme) {
    const dark = theme === 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = dark ? '☀️ 浅色' : '🌙 深色';
  };

  /** 切换视图：隐藏其他视图，渲染目标模块 */
  Worktable.showView = function (id) {
    // 切换前先让各模块立即执行待保存的自动保存内容（防抖兜底）
    Object.keys(Worktable.modules).forEach(function (key) {
      const mod = Worktable.modules[key];
      if (mod && mod.flush) mod.flush();
    });

    if (Worktable.currentView) {
      document.getElementById('view-' + Worktable.currentView).classList.remove('active');
    }
    Worktable.currentView = id;
    document.getElementById('view-' + id).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.classList.toggle('active', item.dataset.view === id);
    });

    const mod = Worktable.modules[id];
    if (mod && mod.render) mod.render();

    window.scrollTo(0, 0);
  };

  function renderNav() {
    const navEl = document.getElementById('sidebar-nav');
    navEl.innerHTML = NAV.map(function (item) {
      return `<button type="button" class="nav-item" data-view="${item.id}">
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-name">${item.name}</span>
      </button>`;
    }).join('');

    navEl.addEventListener('click', function (e) {
      const item = e.target.closest('.nav-item');
      if (item) Worktable.showView(item.dataset.view);
    });
  }

  function init() {
    // 1. 读取本地数据（V1 默认 localStorage，未来可换后端）
    Worktable.data = Worktable.Storage.load();

    // 2. 应用保存过的主题与工作台名称
    Worktable.applyTheme(Worktable.data.settings.theme || 'light');
    Worktable.applyName(Worktable.data.settings.worktableName);

    // 3. 渲染侧边栏导航
    renderNav();

    // 4. 全局事件委托：点击 [data-goto] 元素跳转到对应视图
    document.getElementById('content').addEventListener('click', function (e) {
      const goto = e.target.closest('[data-goto]');
      if (goto) Worktable.showView(goto.dataset.goto);
    });

    // 5. 左下角主题快速切换按钮
    document.getElementById('theme-toggle').addEventListener('click', function () {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      Worktable.data.settings.theme = next;
      Worktable.saveData();
      Worktable.applyTheme(next);
    });

    // 6. 打开默认视图（仪表盘）
    Worktable.showView('dashboard');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
