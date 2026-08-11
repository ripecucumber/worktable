/* ============================================================
   settings.js — 设置
   外观（深浅色主题）、数据备份（导出/导入 JSON）、清空数据
   ============================================================ */

(function () {
  const viewId = 'settings';
  const el = document.getElementById('view-' + viewId);

  function render() {
    const theme = Worktable.data.settings.theme || 'light';
    const worktableName = Worktable.data.settings.worktableName || '我的工作台';

    el.innerHTML = `
      <h1 class="page-title">⚙️ 设置</h1>

      <div class="settings-grid">
        <div class="card">
          <h3>🪪 工作台名称</h3>
          <div class="form-row">
            <input id="name-input" class="input grow" placeholder="我的工作台" value="${Worktable.escapeHtml(worktableName)}">
            <button type="button" class="btn btn-primary" id="btn-save-name">保存名称</button>
          </div>
          <p class="settings-note">修改后，左侧边栏标题和浏览器标签页标题会同步更新。</p>
        </div>

        <div class="card">
          <h3>🎨 外观</h3>
          <div class="radio-row">
            <label><input type="radio" name="theme" value="light" ${theme === 'light' ? 'checked' : ''}> ☀️ 浅色</label>
            <label><input type="radio" name="theme" value="dark" ${theme === 'dark' ? 'checked' : ''}> 🌙 深色</label>
          </div>
          <p class="settings-note">主题会保存在本地，下次打开仍然生效。也可以在左下角按钮快速切换。</p>
        </div>

        <div class="card">
          <h3>💾 数据备份</h3>
          <p class="settings-note">你的全部数据（待办、笔记、书签、日程）都保存在本机浏览器中。建议定期导出备份，换浏览器或换电脑时通过导入恢复。</p>
          <div class="setting-actions">
            <button type="button" class="btn btn-primary" id="btn-export">⬇️ 导出数据（JSON）</button>
            <button type="button" class="btn" id="btn-import">⬆️ 导入数据</button>
            <input type="file" id="import-file" accept=".json,application/json" class="hidden">
            <button type="button" class="btn btn-danger" id="btn-clear">🗑️ 清空所有数据</button>
          </div>
        </div>

        <div class="card">
          <h3>ℹ️ 关于</h3>
          <p class="settings-note">
            <b>我的工作台</b> V1 —— 一个纯前端个人工作台，无需服务器、无需联网。
            <br>数据存储：<b>${Worktable.Storage.name || 'localStorage'}</b>
            <br><br>📖 详细使用说明和「如何升级到后端存储」请查看项目里的 <b>README.md</b>。
          </p>
        </div>
      </div>
    `;
  }

  function refreshAll() {
    Worktable.applyTheme(Worktable.data.settings.theme || 'light');
    Worktable.showView(Worktable.currentView);
  }

  function init() {
    // 保存工作台名称
    el.addEventListener('click', function (e) {
      if (e.target.id === 'btn-save-name') {
        const name = document.getElementById('name-input').value.trim() || '我的工作台';
        Worktable.data.settings.worktableName = name;
        Worktable.saveData();
        Worktable.applyName(name);
        Worktable.toast('名称已保存');
        return;
      }
    });

    // 主题切换
    el.addEventListener('change', function (e) {
      if (e.target.name === 'theme') {
        Worktable.data.settings.theme = e.target.value;
        Worktable.saveData();
        Worktable.applyTheme(e.target.value);
        Worktable.toast('主题已切换');
      }
    });

    // 导出
    el.addEventListener('click', function (e) {
      if (e.target.id === 'btn-export') {
        const blob = new Blob([Worktable.Storage.exportData()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'worktable-backup-' + Worktable.today() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        Worktable.toast('已导出备份文件');
        return;
      }

      // 导入：触发文件选择
      if (e.target.id === 'btn-import') {
        document.getElementById('import-file').click();
        return;
      }

      // 清空数据（需确认两次）
      if (e.target.id === 'btn-clear') {
        if (!confirm('确定要清空所有数据吗？此操作不可恢复！')) return;
        if (!confirm('再次确认：所有待办、笔记、书签、日程都将被删除。建议先导出备份。确定清空？')) return;
        Worktable.Storage.reset();
        Worktable.data = Worktable.Storage.load();
        refreshAll();
        Worktable.toast('已清空所有数据');
      }
    });

    // 导入：读取文件并恢复
    el.addEventListener('change', function (e) {
      const fileInput = e.target;
      if (fileInput.id !== 'import-file' || !fileInput.files || !fileInput.files[0]) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          Worktable.data = Worktable.Storage.importData(reader.result);
          refreshAll();
          Worktable.toast('导入成功！共恢复 ' + Worktable.data.tasks.length + ' 条待办、' + Worktable.data.notes.length + ' 条笔记、' + Worktable.data.bookmarks.length + ' 条书签、' + Worktable.data.events.length + ' 条日程');
        } catch (err) {
          console.error(err);
          Worktable.toast('导入失败：文件不是有效的工作台备份');
        }
      };
      reader.readAsText(fileInput.files[0]);
      fileInput.value = ''; // 允许再次选择同一个文件
    });
  }

  Worktable.register(viewId, { init: init, render: render });
  init();
})();
