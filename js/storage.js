/* ============================================================
   storage.js — 数据层（核心设计：为未来后端升级预留接口）

   V1 使用浏览器 localStorage 把数据保存在本机，无需服务器。

   所有读写都通过 Worktable.Storage 的统一接口：
     load()        → 读取全部数据（返回对象）
     save(data)    → 保存全部数据
     exportData()  → 导出为 JSON 字符串
     importData()  → 从 JSON 字符串导入（校验并合并）
     reset()       → 清空所有数据
     use(storage)  → 切换存储实现（升级后端时用）

   未来升级为「网页 + 后端存储」时：
   1. 新建 js/backend.js，实现与 LocalStorageStorage 相同的 5 个方法
   2. 在 app.js 初始化时调用 Worktable.Storage.use(BackendStorage)
   3. 其余代码（各功能模块）完全不用改
   详见 README.md「如何升级到后端存储」一节。
   ============================================================ */

(function () {
  const STORAGE_KEY = 'worktable_data_v1';

  /** 数据默认结构。新增字段时在这里补充默认值即可，旧数据会自动合并。 */
  const DEFAULT_DATA = {
    tasks: [],        // 待办任务
    notes: [],        // 笔记与代码片段
    bookmarks: [],    // 书签收藏
    events: [],       // 日历日程
    folders: [],      // 全局文件夹（笔记分类 / 项目文件夹）
    projects: [],     // 项目（进度管理）
    studyRecords: [], // 学习记录 [{ id, date, subject(学了什么), minutes(时长分钟), createdAt }]
    settings: {}      // 设置（主题、工作台名称等）
  };

  /** 旧版 studyLog（{date, seconds}）迁移为学习记录（subject 默认"学习"） */
  function migrateStudyLog(data, raw) {
    if (!data.studyRecords.length && raw.studyLog && Array.isArray(raw.studyLog) && raw.studyLog.length) {
      data.studyRecords = raw.studyLog.map(function (l) {
        return {
          id: 'mig' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          date: l.date || '',
          subject: '学习',
          minutes: Math.max(1, Math.round((l.seconds || 0) / 60)),
          createdAt: new Date().toISOString()
        };
      });
    }
    delete data.studyLog; // 迁移完成后不再保留旧字段
  }

  function getEmptyData() {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  /** 校验并合并外部数据，保证结构完整（缺字段补默认值，多出的未知字段忽略） */
  function normalize(raw) {
    const data = getEmptyData();
    if (raw && typeof raw === 'object') {
      Object.keys(DEFAULT_DATA).forEach(function (key) {
        if (key === 'settings') {
          if (raw.settings && typeof raw.settings === 'object') data.settings = raw.settings;
        } else if (Array.isArray(raw[key])) {
          data[key] = raw[key];
        }
      });
      migrateStudyLog(data, raw);
    }
    return data;
  }

  /* ---------- 实现一：localStorage（V1 默认使用） ---------- */
  const LocalStorageStorage = {
    name: 'localStorage（保存在本机浏览器）',
    load: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return getEmptyData();
        return normalize(JSON.parse(raw));
      } catch (e) {
        console.error('读取本地数据失败：', e);
        return getEmptyData();
      }
    },
    save: function (data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },
    exportData: function () {
      return JSON.stringify(this.load(), null, 2);
    },
    importData: function (jsonText) {
      const parsed = JSON.parse(jsonText); // 格式错误会在这里抛出异常
      const data = normalize(parsed);
      this.save(data);
      return data;
    },
    reset: function () {
      this.save(getEmptyData());
    }
  };

  /* 当前使用的存储实现。升级后端时改为：let current = BackendStorage; */
  let current = LocalStorageStorage;

  /** 对外统一接口 */
  Worktable.Storage = {
    /** 切换存储实现（升级后端时调用） */
    use: function (storage) { current = storage; },
    load: function () { return current.load(); },
    save: function (data) { current.save(data); },
    exportData: function () { return current.exportData(); },
    importData: function (text) { return current.importData(text); },
    reset: function () { current.reset(); }
  };

  /** 保存当前内存中的全部数据（各功能模块修改数据后调用它） */
  Worktable.saveData = function () {
    Worktable.Storage.save(Worktable.data);
  };
})();
