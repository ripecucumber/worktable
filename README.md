# 🗂️ 我的工作台

一个**零依赖、纯前端**的个人工作台。不需要安装任何软件、不需要联网、不需要服务器——用浏览器打开就能用，所有数据保存在本机。

## ✨ 功能一览

| 模块 | 功能 |
| --- | --- |
| 📊 仪表盘 | 今日待办（可直接勾选）、今日日程、最近笔记/书签、任务完成率 |
| ✅ 待办任务 | 增删改查、优先级（高/中/低）、截止日期、项目分类、状态/项目筛选、搜索 |
| 📝 笔记 & 代码片段 | Markdown 编写 + 预览（标题/列表/引用/表格/**数学公式**）、标签、搜索；代码片段带语言标记和一键复制；**自定义文件夹分类**（新建/重命名/删除，项目自动创建同名文件夹） |
| 🔖 书签收藏 | 收藏网址、标签/备注、点击新窗口打开、搜索、按标签筛选、复制链接 |
| 📅 日历 | 月视图、添加/编辑/删除日程、显示到期待办、**可跳转到任意日期** |
| 📦 项目 | 管理进行中的项目：名称/描述、**进度百分比（滑块或手动输入）**、项目专属笔记（自动归入同名文件夹） |
| 📈 每日回顾 | 按天查看：**学习记录**（每条记录"学了什么 + 时长"，内置计时器自动生成记录，可手动添加/编辑/删除）、待办完成率、当天新建笔记/书签、当天日程 |
| ⚙️ 设置 | **自定义工作台名称**、深浅色主题切换、数据导出/导入（JSON 备份）、清空数据 |

## 📝 Markdown 支持一览

笔记和项目笔记支持以下 Markdown 语法：

| 语法 | 示例 | 说明 |
| --- | --- | --- |
| 标题 | `# 标题` / `## 二级` | 最多三级 |
| 列表 | `- 项目` / `1. 步骤` | 无序/有序 |
| 引用 | `> 引用内容` | |
| 分隔线 | `---` | |
| 代码块 | ```` ```javascript ```` | 带语言标记 + 一键复制 |
| 表格 | `\| 列A \| 列B \|` + `\| --- \| --- \|` | 表头 + 分隔行 |
| 加粗 / 斜体 | `**文字**` / `*文字*` | |
| 行内代码 | `` `code` `` | |
| 链接 | `[文字](https://... )` | 新窗口打开 |
| **数学公式** | `$E = mc^2$`（行内） | KaTeX 渲染，支持分数、积分、矩阵等 LaTeX 语法 |
| | `$$\int_0^1 x^2 dx$$`（块级） | 独立一行、居中显示 |

> 数学公式示例：`$x^2 + y^2 = z^2$`、`$\frac{a}{b}$`、`$$\sum_{i=1}^{n} i = \frac{n(n+1)}{2}$$`、`$$\begin{pmatrix} 1 & 2 \\ 3 & 4 \end{pmatrix}$$`

## 🚀 使用方法

**方式一（推荐）：双击打开**
直接双击 `index.html`，浏览器打开即可使用。

**方式二：本地服务器**
在项目目录下运行：
```
python -m http.server 8000
```
然后浏览器访问 `http://localhost:8000`（体验最稳定）。

## 📁 项目结构

```
worktable/
├── index.html          # 页面骨架：侧边栏 + 内容区
├── css/
│   └── style.css       # 全部样式（CSS 变量实现深浅色主题）
├── js/
│   ├── utils.js        # 工具函数（日期、HTML 转义、Markdown 渲染、Toast）
│   ├── storage.js      # ★ 数据层：统一存储接口 + localStorage 实现
│   ├── app.js          # 入口：导航、视图切换、初始化
│   ├── dashboard.js    # 仪表盘
│   ├── tasks.js        # 待办任务
│   ├── notes.js        # 笔记 & 代码片段（含文件夹分类）
│   ├── bookmarks.js    # 书签收藏
│   ├── calendar.js     # 日历（含日期跳转）
│   ├── projects.js     # 项目（进度管理 + 项目笔记）
│   ├── review.js       # 每日回顾（学习记录 + 计时器 + 统计）
│   └── settings.js     # 设置（名称、主题、备份）
├── vendor/
│   └── katex/          # KaTeX 数学公式渲染库（本地文件，离线可用）
└── README.md
```

## 💾 数据说明

- 所有数据（待办、笔记、书签、日程、主题设置）以 JSON 形式保存在浏览器 `localStorage` 中。
- 建议定期在「设置 → 数据备份」中**导出** JSON 文件；换浏览器、换电脑时通过**导入**恢复。
- 数据会一直保留，直到你手动清空或浏览器清除站点数据。

## 🔧 如何升级到「网页 + 后端存储」

本项目的数据层做了**接口抽象**，升级后端时**其余代码完全不用改**，只需三步：

### 第 1 步：新建 `js/backend.js`

实现与 localStorage 版本相同的 5 个方法（以任意后端语言实现 API 为例）：

```js
// js/backend.js
const BackendStorage = {
  name: '服务器（需要后端 API 支持）',

  // 读取全部数据
  load: function () {
    return fetch('/api/data').then(r => r.json());
  },

  // 保存全部数据
  save: function (data) {
    return fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  },

  exportData: function () {
    return this.load().then(data => JSON.stringify(data, null, 2));
  },

  importData: function (jsonText) {
    const data = JSON.parse(jsonText);
    return this.save(data).then(() => data);
  },

  reset: function () {
    return this.save({ tasks: [], notes: [], bookmarks: [], events: [], settings: {} });
  }
};
```

### 第 2 步：注册后端存储

在 `index.html` 中、`app.js` 之前引入 `js/backend.js`，然后在 `app.js` 的 `init()` 中切换：

```js
// js/app.js 的 init() 开头：
Worktable.Storage.use(BackendStorage);   // 加这一行即可
Worktable.data = Worktable.Storage.load();
```

### 第 3 步：处理异步

后端存储的 `load()` 返回 Promise（异步）。因此 `init()` 需要改为异步等待：

```js
function init() {
  Worktable.Storage.use(BackendStorage);
  Worktable.Storage.load().then(function (data) {
    Worktable.data = data;
    // ……其余初始化逻辑不变
  });
}
```

> 小提示：如果想保留「导出/导入 JSON 备份」功能，后端还需要实现对应的 API（如 `GET /api/data`、`POST /api/data`）。数据 JSON 结构为：`{ tasks: [], notes: [], bookmarks: [], events: [], folders: [], projects: [], studyRecords: [], settings: {} }`。

## 🛠 常见问题

- **数据存在哪里？** 本机浏览器 `localStorage`，不会上传到任何服务器。
- **想改功能？** 每个模块一个 JS 文件、每个界面一个函数，命名清晰，直接改对应文件即可。改完刷新浏览器生效。
- **想加新模块？** 仿照任一模块：新建 `js/xxx.js`，实现 `init()` 和 `render()`，用 `Worktable.register('xxx', {...})` 注册，再在 `index.html` 加一个 `<section id="view-xxx">`、在 `app.js` 的 `NAV` 里加一项。
