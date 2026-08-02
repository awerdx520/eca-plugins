// 通用工具模块（eca-common-tools）
// 提供 json_format（JSON 格式化/压缩/排序）、csv_to_markdown（CSV → Markdown 表格）、
// regex_test（正则测试）三个工具，全部零第三方依赖纯 JS 实现
// 模块化约定：导出 utilTools 工具定义数组与 handleUtilCall 调用分发函数，供 index.mjs 聚合

import { spawn } from "node:child_process";

// ── 工具定义 ──

export const utilTools = [
  {
    name: "json_format",
    description:
      "格式化/压缩/排序 JSON 文本。传入 JSON 字符串，返回格式化后的内容；解析失败时返回错误信息（含位置）。",
    inputSchema: {
      type: "object",
      properties: {
        json: {
          type: "string",
          description: "要格式化的 JSON 文本",
        },
        indent: {
          type: "number",
          description: "缩进空格数（默认 2）",
        },
        sort_keys: {
          type: "boolean",
          description: "是否对对象键排序（默认 false）",
        },
        compact: {
          type: "boolean",
          description: "true 时输出压缩 JSON（忽略 indent），默认 false",
        },
      },
      required: ["json"],
    },
  },
  {
    name: "csv_to_markdown",
    description:
      "将 CSV 文本转换为 Markdown 表格。支持自定义分隔符与引号包裹字段（含逗号、换行、双引号转义）。",
    inputSchema: {
      type: "object",
      properties: {
        csv: {
          type: "string",
          description: "CSV 文本",
        },
        delimiter: {
          type: "string",
          description: "分隔符（默认 ','）",
        },
        has_header: {
          type: "boolean",
          description: "首行是否为表头（默认 true）",
        },
      },
      required: ["csv"],
    },
  },
  {
    name: "regex_test",
    description:
      "测试正则表达式。传入 pattern（不含斜杠）、flags 与待测试文本，返回匹配次数、位置与捕获组；编译错误或超时（疑似灾难性回溯）返回错误信息。正则执行在子进程中隔离，2 秒超时。",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "正则表达式模式（不含斜杠），如 '\\\\d+'",
        },
        flags: {
          type: "string",
          description: "正则标志（默认 ''），如 'gim'",
        },
        text: {
          type: "string",
          description: "要测试的文本",
        },
      },
      required: ["pattern", "text"],
    },
  },
];

// ── json_format 实现 ──

/**
 * 格式化 JSON。compact 时输出压缩 JSON；否则按 indent 缩进、可选 sort_keys。
 * 解析失败返回 { success: false, error }（含 JSON.parse 的位置信息）。
 */
function formatJson(jsonText, indent, sortKeys, compact) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    // err.message 形如 "Unexpected token ... in JSON at position 42"
    const posMatch = String(err.message).match(/position (\d+)/);
    const pos = posMatch ? parseInt(posMatch[1], 10) : null;
    const posSuffix = pos !== null ? ` (位置 ${pos})` : "";
    return { success: false, error: `JSON 解析错误: ${err.message}${posSuffix}` };
  }

  const space = compact ? undefined : (typeof indent === "number" ? indent : 2);
  const out = JSON.stringify(parsed, sortKeys ? Object.keys(parsed).sort() : null, space);
  return { success: true, content: out };
}

// ── csv_to_markdown 实现 ──

/**
 * 状态机 CSV 解析器：处理引号包裹字段、引号内逗号、引号内换行、双引号转义（""）。
 * 返回二维数组；解析失败返回 { success: false, error }。
 */
function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    if (ch === "\r") {
      continue; // 忽略 \r（Windows 换行），\n 已处理
    }
    field += ch;
  }
  // 收尾：处理最后一行（无结尾换行时）
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (inQuotes) {
    return { success: false, error: "CSV 解析错误: 引号未闭合" };
  }
  return { success: true, rows };
}

/** 转义 Markdown 表格单元格中的 | 与换行 */
function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
}

/**
 * CSV → Markdown 表格。has_header 时首行作为表头（加粗 + 分隔行）。
 */
function csvToMarkdown(csvText, delimiter, hasHeader) {
  const parsed = parseCsv(csvText, delimiter || ",");
  if (!parsed.success) return parsed;

  const rows = parsed.rows;
  if (rows.length === 0) {
    return { success: true, content: "（空表格）" };
  }

  const header = hasHeader !== false ? rows[0] : null;
  const body = header ? rows.slice(1) : rows;

  const lines = [];
  if (header) {
    lines.push("| " + header.map(escapeCell).join(" | ") + " |");
    lines.push("| " + header.map(() => "---").join(" | ") + " |");
  }
  for (const r of body) {
    lines.push("| " + r.map(escapeCell).join(" | ") + " |");
  }
  return { success: true, content: lines.join("\n") };
}

// ── regex_test 实现 ──

/**
 * 在子进程中执行正则测试（防灾难性回溯卡死 MCP 主进程）。
 * 通过 node -e 脚本执行，2 秒超时 kill。
 */
function runRegexInSubprocess(pattern, flags, text) {
  return new Promise((resolve) => {
    // 脚本：编译正则 → 收集匹配；编译错误或匹配输出 JSON 到 stdout
    const script = `
      const [pattern, flags, text] = JSON.parse(process.argv[1]);
      try {
        const re = new RegExp(pattern, flags);
        const results = [];
        let m;
        const globalRe = flags.includes('g') ? re : new RegExp(re.source, re.flags + 'g');
        while ((m = globalRe.exec(text)) !== null) {
          results.push({
            match: m[0],
            start: m.index,
            end: m.index + m[0].length,
            groups: m.slice(1),
          });
          if (m.index === globalRe.lastIndex) globalRe.lastIndex++; // 防零宽匹配死循环
        }
        process.stdout.write(JSON.stringify({ ok: true, count: results.length, results }));
      } catch (err) {
        process.stdout.write(JSON.stringify({ ok: false, error: String(err.message) }));
      }
    `;

    const proc = spawn("node", ["-e", script, JSON.stringify([pattern, flags, text])], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
    }, 2000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === null) {
        resolve({ success: false, error: "正则执行超时（>2s），疑似灾难性回溯" });
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.ok) resolve({ success: true, ...parsed });
        else resolve({ success: false, error: `正则编译错误: ${parsed.error}` });
      } catch {
        resolve({ success: false, error: `正则执行失败: ${stderr.trim() || "未知错误"}` });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ success: false, error: `子进程启动失败: ${err.message}` });
    });
  });
}

/**
 * 格式化正则测试结果为可读文本。
 */
function formatRegexResult(result) {
  if (result.count === 0) return "无匹配";
  const lines = [`共 ${result.count} 处匹配:`];
  result.results.forEach((r, i) => {
    lines.push(
      `${i + 1}. "${r.match}" [${r.start}-${r.end}]` +
        (r.groups && r.groups.length > 0 ? ` 捕获组: [${r.groups.join(", ")}]` : "")
    );
  });
  return lines.join("\n");
}

// ── 工具调用分发 ──

/**
 * 分发 util 相关工具调用，返回 MCP CallToolResult 形状
 * @param {string} name 工具名
 * @param {object} args 工具参数
 */
export async function handleUtilCall(name, args) {
  switch (name) {
    case "json_format": {
      const { json, indent, sort_keys, compact } = args || {};
      if (typeof json !== "string") {
        return {
          content: [{ type: "text", text: "缺少必需参数 json" }],
          isError: true,
        };
      }
      const result = formatJson(json, indent, sort_keys, compact);
      if (result.success) {
        return { content: [{ type: "text", text: result.content }] };
      }
      return {
        content: [{ type: "text", text: `⚠️ ${result.error}` }],
        isError: true,
      };
    }

    case "csv_to_markdown": {
      const { csv, delimiter, has_header } = args || {};
      if (typeof csv !== "string") {
        return {
          content: [{ type: "text", text: "缺少必需参数 csv" }],
          isError: true,
        };
      }
      const result = csvToMarkdown(csv, delimiter, has_header);
      if (result.success) {
        return { content: [{ type: "text", text: result.content }] };
      }
      return {
        content: [{ type: "text", text: `⚠️ ${result.error}` }],
        isError: true,
      };
    }

    case "regex_test": {
      const { pattern, flags, text } = args || {};
      if (typeof pattern !== "string" || !pattern) {
        return {
          content: [{ type: "text", text: "缺少必需参数 pattern" }],
          isError: true,
        };
      }
      if (typeof text !== "string") {
        return {
          content: [{ type: "text", text: "缺少必需参数 text" }],
          isError: true,
        };
      }
      const result = await runRegexInSubprocess(pattern, flags || "", text);
      if (result.success) {
        return { content: [{ type: "text", text: formatRegexResult(result) }] };
      }
      return {
        content: [{ type: "text", text: `⚠️ ${result.error}` }],
        isError: true,
      };
    }

    default:
      return {
        content: [{ type: "text", text: `未知工具: ${name}` }],
        isError: true,
      };
  }
}
