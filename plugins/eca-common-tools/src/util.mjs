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
  {
    name: "test_result_summarize",
    description:
      "解析测试命令输出，自动识别框架（pytest/jest/go test），只返回失败用例与错误摘要（默认最多 10 个，含文件:行:列）。输入完整测试输出，返回结构化摘要；无失败时返回通过确认。",
    inputSchema: {
      type: "object",
      properties: {
        output: {
          type: "string",
          description: "测试命令的完整输出",
        },
        framework: {
          type: "string",
          description: "可选。框架指定：'auto'（自动探测，默认）|'pytest'|'jest'|'go'",
        },
        max_failures: {
          type: "number",
          description: "可选。最多返回的失败用例数（默认 10）",
        },
      },
      required: ["output"],
    },
  },
  {
    name: "stack_trace_analyze",
    description:
      "解析多语言堆栈跟踪（Python/JS/Java/Go），返回错误类型、调用链摘要与首个项目内文件位置。传入堆栈文本，返回结构化分析；无法识别格式时返回错误。",
    inputSchema: {
      type: "object",
      properties: {
        trace: {
          type: "string",
          description: "堆栈跟踪文本",
        },
        project_root: {
          type: "string",
          description: "可选。项目根目录路径，用于判断哪些帧属于项目文件",
        },
      },
      required: ["trace"],
    },
  },
  {
    name: "code_block_extract",
    description:
      "从文本中提取 ``` 代码块。支持按语言过滤、按序号选取单个代码块；检测到未闭合代码块（``` 数量为奇数）时输出警告。传入含代码块的文本，返回代码块列表或指定单个。",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "包含代码块的文本",
        },
        language: {
          type: "string",
          description: "可选。只提取指定语言代码块，如 'javascript'/'python'",
        },
        index: {
          type: "number",
          description: "可选。只提取第 N 个代码块（1-based）",
        },
      },
      required: ["text"],
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

// ── test_result_summarize 实现 ──

/** 自动探测测试框架：pytest / jest / go test */
function detectTestFramework(output) {
  if (/=== FAILURES ===|^FAILED |_pytest\.outcomes|(\d+) passed/.test(output)) return "pytest";
  if (/Test Suites:|✓|✕|●|PASS \/ FAIL/.test(output) && /Tests:/.test(output)) return "jest";
  if (/^--- FAIL:|\bFAIL\s+$|^ok\s+\S+\s+\d/.test(output)) return "go";
  return null;
}

/**
 * 解析 pytest 输出：提取 FAILURES 节中的失败用例
 */
function summarizePytest(output, maxFailures) {
  const failures = [];
  // 匹配 "____ test_name ____" 失败节标题（下划线包裹）
  const sectionRe = /_{4,}\s*(.+?)\s*_{4,}/g;
  const lines = output.split("\n");
  const sections = [];
  let m;
  while ((m = sectionRe.exec(output)) !== null) {
    sections.push({ title: m[1].trim() });
  }
  // 也匹配 "FAILED path::test - message" 汇总行
  const failedLines = [];
  for (const line of lines) {
    if (/^FAILED\s/.test(line)) failedLines.push(line.trim());
  }

  for (const s of sections.slice(0, maxFailures)) {
    failures.push({ title: s.title, location: "", detail: "" });
  }
  // 若只有 FAILED 汇总行（pytest -q 模式），用它们
  if (failures.length === 0 && failedLines.length > 0) {
    for (const line of failedLines.slice(0, maxFailures)) {
      const m2 = line.match(/^FAILED\s+(\S+)\s*-\s*(.*)$/);
      failures.push({ title: m2 ? m2[1] : line, location: m2 ? m2[1] : "", detail: m2 ? m2[2] : "" });
    }
  }
  return failures;
}

/**
 * 解析 jest 输出：提取 ● 失败节点
 */
function summarizeJest(output, maxFailures) {
  const failures = [];
  const lines = output.split("\n");
  let current = null;
  for (const line of lines) {
    const failMatch = line.match(/^\s*●\s+(.+)$/); // 容忍 jest 输出中 ● 前的缩进
    if (failMatch) {
      current = { title: failMatch[1].trim(), detail: "" };
      failures.push(current);
      if (failures.length >= maxFailures) break;
      continue;
    }
    if (current && /^\s{2,}(at |expect|Error)/.test(line) && !current.detail) {
      current.detail = line.trim();
    }
  }
  return failures;
}

/**
 * 解析 go test 输出：提取 --- FAIL 节
 */
function summarizeGo(output, maxFailures) {
  const failures = [];
  const lines = output.split("\n");
  let current = null;
  for (const line of lines) {
    const failMatch = line.match(/^--- FAIL:\s*(.+?)\s*\((.+)\)$/);
    if (failMatch) {
      current = { title: failMatch[1].trim(), location: failMatch[2], detail: "" };
      failures.push(current);
      if (failures.length >= maxFailures) break;
      continue;
    }
    if (current && /^\s+(.*\.go:\d+)/.test(line) && !current.detail) {
      current.detail = line.trim();
    }
  }
  return failures;
}

/**
 * 汇总测试输出为失败摘要。framework 可指定或自动探测。
 */
function summarizeTestOutput(output, framework, maxFailures) {
  const limit = typeof maxFailures === "number" && maxFailures > 0 ? maxFailures : 10;
  const detected = framework && framework !== "auto" ? framework : detectTestFramework(output);
  if (!detected) {
    return { success: false, error: "无法识别的测试输出格式（支持 pytest/jest/go test）" };
  }

  let failures = [];
  if (detected === "pytest") {
    failures = summarizePytest(output, limit);
  } else if (detected === "jest") {
    failures = summarizeJest(output, limit);
  } else if (detected === "go") {
    failures = summarizeGo(output, limit);
  }

  if (failures.length === 0) {
    return { success: true, content: "✅ 全部通过（未检测到失败）" };
  }

  const lines = [`框架: ${detected}`, `失败用例 ${failures.length} 个:`];
  failures.forEach((f, i) => {
    lines.push(`${i + 1}. ${f.title}`);
    if (f.location) lines.push(`   位置: ${f.location}`);
    if (f.detail) lines.push(`   详情: ${f.detail}`);
  });
  if (failures.length >= limit) lines.push(`…（仅显示前 ${limit} 个，共 ${failures.length} 个失败）`);
  return { success: true, content: lines.join("\n") };
}

// ── stack_trace_analyze 实现 ──

/** 系统/依赖目录（判断"项目文件"用排除法） */
const SYSTEM_DIRS = ["node_modules", "venv", "site-packages", "usr/lib", "go/src", "dist-packages", ".cache"];

/** 判断是否为项目文件路径（不在系统目录中） */
function isProjectFile(path, projectRoot) {
  if (!path) return false;
  if (projectRoot && path.startsWith(projectRoot)) return true;
  return !SYSTEM_DIRS.some((d) => path.includes(d));
}

/** 自动探测堆栈语言 */
function detectTraceLanguage(trace) {
  if (/Traceback \(most recent call last\)|File ".*", line \d+/.test(trace)) return "python";
  if (/at .+ \(.+:\d+:\d+\)|at .+:\d+:\d+/.test(trace)) return "js";
  if (/^\s*at [\w.]+\.\w+\(.+\.java:\d+\)/m.test(trace)) return "java";
  if (/goroutine \d+ \[running\]/.test(trace)) return "go";
  return null;
}

/**
 * 解析堆栈为结构化摘要：错误类型 + 调用链 + 首个项目文件位置。
 */
function analyzeStackTrace(trace, projectRoot) {
  const lines = trace.split("\n").map((l) => l.trimEnd());
  if (!trace.trim()) return { success: false, error: "堆栈为空" };

  const lang = detectTraceLanguage(trace);
  if (!lang) return { success: false, error: "无法识别的堆栈格式（支持 Python/JS/Java/Go）" };

  // 错误类型 + 消息（首行）
  const firstLine = lines[0];
  let errorType = "";
  let errorMessage = "";
  if (lang === "python") {
    const lastLine = lines[lines.length - 1];
    errorType = lastLine.split(":")[0]?.trim() || firstLine.trim();
    errorMessage = lastLine.includes(":") ? lastLine.slice(lastLine.indexOf(":") + 1).trim() : "";
  } else if (lang === "js") {
    const errMatch = firstLine.match(/^(\w+Error):\s*(.*)$/);
    if (errMatch) { errorType = errMatch[1]; errorMessage = errMatch[2]; }
  } else if (lang === "java") {
    const errMatch = firstLine.match(/^([\w.]+Exception):\s*(.*)$/);
    if (errMatch) { errorType = errMatch[1]; errorMessage = errMatch[2]; }
  } else if (lang === "go") {
    const panicMatch = lines.find((l) => /^panic:|^fatal error:/.test(l));
    if (panicMatch) { errorType = panicMatch.split(":")[0]; errorMessage = panicMatch.slice(panicMatch.indexOf(":") + 1).trim(); }
  }

  // 提取调用链帧
  const frames = [];
  for (const line of lines) {
    let loc = null;
    if (lang === "python") {
      const m = line.match(/File "([^"]+)", line (\d+)/);
      if (m) loc = { file: m[1], line: m[2] };
    } else if (lang === "js") {
      const m = line.match(/at .*?\(?([^()\s]+):(\d+):(\d+)\)?$/); // 非贪婪：避免 .* 吃掉路径导致捕获残缺
      if (m) loc = { file: m[1], line: m[2], col: m[3] };
      else {
        const m2 = line.match(/at (.+):(\d+):(\d+)$/);
        if (m2) loc = { file: m2[1], line: m2[2], col: m2[3] };
      }
    } else if (lang === "java") {
      const m = line.match(/at ([\w.]+)\((\w+\.java):(\d+)\)/);
      if (m) loc = { file: m[2], line: m[3] };
    } else if (lang === "go") {
      const m = line.match(/(.+\.go):(\d+)/);
      if (m && !line.includes("goroutine")) loc = { file: m[1], line: m[2] };
    }
    if (loc && loc.file !== "evalmachine.<anonymous>") frames.push(loc);
  }

  // 首个项目文件帧
  let firstProject = null;
  for (const f of frames) {
    if (isProjectFile(f.file, projectRoot)) { firstProject = f; break; }
  }

  const out = [];
  out.push(`语言: ${lang}`);
  if (errorType) out.push(`错误类型: ${errorType}`);
  if (errorMessage) out.push(`错误消息: ${errorMessage}`);
  out.push(`调用链 (${Math.min(frames.length, 20)} 帧):`);
  for (const f of frames.slice(0, 20)) {
    out.push(`  ${f.file}:${f.line}${f.col ? ":" + f.col : ""}`);
  }
  if (firstProject) {
    out.push(`🎯 首个项目内位置: ${firstProject.file}:${firstProject.line}`);
  } else {
    out.push("（未找到项目内帧，堆栈可能全部来自依赖/系统代码）");
  }
  return { success: true, content: out.join("\n") };
}

// ── code_block_extract 实现 ──

/**
 * 从文本中提取代码块。返回 { blocks, unclosed }。
 */
function extractCodeBlocks(text) {
  const fenceRe = /```([\w+-]*)\n?([\s\S]*?)```/g;
  const blocks = [];
  let m;
  while ((m = fenceRe.exec(text)) !== null) {
    blocks.push({ language: (m[1] || "").trim(), content: m[2] });
  }
  // 未闭合检测：统计 ``` 出现次数（含未匹配的）
  const fenceCount = (text.match(/```/g) || []).length;
  const unclosed = fenceCount % 2 === 1;
  return { blocks, unclosed };
}

/**
 * 格式化代码块提取结果。支持语言过滤与序号选取。
 */
function formatCodeBlocks(text, language, index) {
  const { blocks, unclosed } = extractCodeBlocks(text);

  const warn = unclosed ? "\n⚠️ 检测到未闭合代码块（LLM 输出可能被截断）" : "";

  // 语言过滤
  let filtered = blocks;
  if (language) {
    filtered = blocks.filter((b) => b.language === language || b.language === "");
  }

  // 序号选取（1-based）
  if (typeof index === "number") {
    if (index < 1 || index > filtered.length) {
      return { success: false, error: `index 超出范围：共 ${filtered.length} 个代码块，请求第 ${index} 个` };
    }
    const b = filtered[index - 1];
    return { success: true, content: `语言: ${b.language || "（未标注）"}\n\n${b.content}${warn}` };
  }

  if (filtered.length === 0) {
    return { success: true, content: `未找到代码块${language ? `（语言: ${language}）` : ""}${warn}` };
  }

  const out = [`共 ${filtered.length} 个代码块:`];
  filtered.forEach((b, i) => {
    out.push(`\n--- 代码块 ${i + 1} (${b.language || "未标注语言"}) ---`);
    out.push(b.content);
  });
  out.push(warn);
  return { success: true, content: out.join("\n") };
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

    case "test_result_summarize": {
      const { output, framework, max_failures } = args || {};
      if (typeof output !== "string" || !output) {
        return {
          content: [{ type: "text", text: "缺少必需参数 output" }],
          isError: true,
        };
      }
      const result = summarizeTestOutput(output, framework, max_failures);
      if (result.success) {
        return { content: [{ type: "text", text: result.content }] };
      }
      return {
        content: [{ type: "text", text: `⚠️ ${result.error}` }],
        isError: true,
      };
    }

    case "stack_trace_analyze": {
      const { trace, project_root } = args || {};
      if (typeof trace !== "string" || !trace) {
        return {
          content: [{ type: "text", text: "缺少必需参数 trace" }],
          isError: true,
        };
      }
      const result = analyzeStackTrace(trace, project_root);
      if (result.success) {
        return { content: [{ type: "text", text: result.content }] };
      }
      return {
        content: [{ type: "text", text: `⚠️ ${result.error}` }],
        isError: true,
      };
    }

    case "code_block_extract": {
      const { text, language, index } = args || {};
      if (typeof text !== "string") {
        return {
          content: [{ type: "text", text: "缺少必需参数 text" }],
          isError: true,
        };
      }
      const result = formatCodeBlocks(text, language, index);
      if (result.success) {
        return { content: [{ type: "text", text: result.content }] };
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
