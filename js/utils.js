/* ============================================================
   utils.js — 公共工具函数
   1. 全局命名空间 Worktable 与模块注册
   2. ID 生成、日期工具、HTML 转义
   3. 简易 Markdown 渲染器（零依赖，支持标题/列表/引用/代码块/行内样式）
   4. 复制文本、Toast 提示
   ============================================================ */

window.Worktable = window.Worktable || { modules: {} };

/** 注册一个功能模块。模块需提供 init()（绑定事件，只调用一次）和 render()（重建视图） */
Worktable.register = function (name, module) {
  Worktable.modules[name] = module;
};

/** 生成唯一 ID */
Worktable.uid = function () {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
};

/** 今天的日期字符串，格式 YYYY-MM-DD（本地时区） */
Worktable.today = function () {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

/** Date 对象 → YYYY-MM-DD */
Worktable.iso = function (d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

/** HTML 转义，防止用户输入内容破坏页面结构 */
Worktable.escapeHtml = function (str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

/** ISO 时间戳 → 本地日期 YYYY-MM-DD（避免 UTC 时区导致日期差一天） */
Worktable.localDateOf = function (iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

/** YYYY-MM-DD → "8月11日 周二" */
Worktable.formatDate = function (iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  const week = ['日', '一', '二', '三', '四', '五', '六'];
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + week[d.getDay()];
};

/** 截止日期相对今天的中文描述：今天/明天/昨天/逾期 N 天/还有 N 天 */
Worktable.relativeDue = function (iso) {
  if (!iso) return '';
  const today = new Date(Worktable.today() + 'T00:00:00');
  const due = new Date(iso + 'T00:00:00');
  if (isNaN(due.getTime())) return iso;
  const diff = Math.round((due - today) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff < 0) return '逾期 ' + (-diff) + ' 天';
  if (diff < 30) return '还有 ' + diff + ' 天';
  return Worktable.formatDate(iso);
};

/** 行内 Markdown：`代码`、**加粗**、*斜体*、[链接](url) */
Worktable.inlineMd = function (str) {
  return str
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)\n]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
};

/** 判断是否为表格行（以 | 开头和结尾，如 `| a | b |`） */
function isTableRow(line) {
  return /^\s*\|.*\|\s*$/.test(line);
}

/** 判断是否为表格分隔行（如 `|---|---|`、`|:---:| --- |`） */
function isTableSep(line) {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line);
}

/** 拆分表格行：`| a | b |` → ['a', 'b'] */
function splitTableRow(line) {
  return line.trim().replace(/^\||\|$/g, '').split('|').map(function (cell) { return cell.trim(); });
}

/**
 * 简易 Markdown → HTML（零依赖）。
 * 支持：标题 #/##/###、无序/有序列表、引用、分隔线、代码块（含语言标记与复制按钮）、
 * 表格（| 列 | 列 | + 分隔行）、行内样式。
 * 输入内容会先整体转义，保证安全。
 */
Worktable.mdToHtml = function (md) {
  if (!md || !md.trim()) return '<p class="empty">（空内容）</p>';

  const rawLines = md.split('\n');
  const esc = Worktable.escapeHtml; // 内容转义（块级语法先用原始文本判断，再转义内容，避免破坏 `>` 等语法）
  let html = '';

  // 代码块状态
  let inCode = false, codeLang = '', codeBuf = [];
  // 列表状态
  let inList = null, listBuf = [];

  const flushList = function () {
    if (inList) {
      html += '<' + inList + '>' + listBuf.join('') + '</' + inList + '>';
      inList = null; listBuf = [];
    }
  };
  const flushCode = function () {
    html += '<div class="code-block">'
      + '<div class="code-header"><span class="code-lang">' + esc(codeLang || 'code')
      + '</span><button type="button" class="icon-btn btn-copy" title="复制代码">📋</button></div>'
      + '<pre><code>' + esc(codeBuf.join('\n')) + '</code></pre></div>';
    inCode = false; codeLang = ''; codeBuf = [];
  };
  const flushPara = function () {
    if (paraBuf.length) {
      html += '<p>' + paraBuf.map(Worktable.inlineMd).join('<br>') + '</p>';
      paraBuf = [];
    }
  };

  let paraBuf = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // 代码块围栏 ``` 或 ```language
    const fence = line.match(/^```([\w+#-]*)\s*$/);
    if (fence) {
      if (!inCode) { flushList(); flushPara(); inCode = true; codeLang = fence[1] || ''; }
      else flushCode();
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }

    // 标题：`#` → h1，`##` → h2，`###` → h3
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flushList(); flushPara(); const lv = h[1].length; html += '<h' + lv + '>' + Worktable.inlineMd(esc(h[2])) + '</h' + lv + '>'; continue; }

    // 引用
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) { flushList(); flushPara(); html += '<blockquote>' + Worktable.inlineMd(esc(quote[1])) + '</blockquote>'; continue; }

    // 分隔线
    if (/^\s*---+\s*$/.test(line)) { flushList(); flushPara(); html += '<hr>'; continue; }

    // 列表
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const type = ul ? 'ul' : 'ol';
      if (inList !== type) { flushList(); inList = type; }
      listBuf.push('<li>' + Worktable.inlineMd(esc((ul || ol)[1])) + '</li>');
      continue;
    }

    // 表格：表头行 + 下一行是分隔行
    if (isTableRow(line) && i + 1 < rawLines.length && isTableSep(rawLines[i + 1])) {
      flushList(); flushPara();
      const headers = splitTableRow(line);
      i++; // 跳过分隔行
      const rows = [];
      while (i + 1 < rawLines.length && isTableRow(rawLines[i + 1])) {
        rows.push(splitTableRow(rawLines[++i]));
      }
      html += '<table class="md-table"><thead><tr>'
        + headers.map(function (c) { return '<th>' + Worktable.inlineMd(esc(c)) + '</th>'; }).join('')
        + '</tr></thead><tbody>'
        + rows.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + Worktable.inlineMd(esc(c)) + '</td>'; }).join('') + '</tr>';
          }).join('')
        + '</tbody></table>';
      continue;
    }

    // 普通文本行：连续的非空行合并为一个段落
    if (line.trim() === '') { flushList(); flushPara(); }
    else paraBuf.push(esc(line));
  }
  flushList(); flushPara();
  if (inCode) flushCode();

  return html;
};

/** 切换任务完成状态：完成时记录完成时间（completedAt），取消完成时清空 */
Worktable.setTaskDone = function (task, done) {
  task.done = !!done;
  task.completedAt = task.done ? new Date().toISOString() : '';
};

/** 复制文本到剪贴板（含兼容方案），返回是否成功 */
Worktable.copyText = function (text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return Worktable.copyTextFallback(text); });
  }
  return Promise.resolve(Worktable.copyTextFallback(text));
};
Worktable.copyTextFallback = function (text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch (e) { return false; }
};

/** 底部轻提示 */
Worktable.toast = function (msg) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(Worktable.toast._timer);
  Worktable.toast._timer = setTimeout(function () { el.classList.remove('show'); }, 2200);
};
