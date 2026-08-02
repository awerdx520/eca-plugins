// PlantUML 渲染工具模块（eca-common-tools）
// 提供 render_plantuml 工具：接受 PlantUML 源码，渲染为 SVG（无损矢量），返回 base64 data URI
// 性能优化：优先使用常驻 HTTP 服务器（plantuml --http-server）复用 JVM（~16ms），失败回退 CLI（-pipe -tsvg）
// 模块化约定：只导出工具定义、生命周期函数与调用分发函数；MCP 协议由 index.mjs 负责

import { spawn } from "node:child_process";
import { deflateRawSync } from "node:zlib";

// ============ 工具定义 ============
export const plantumlTools = [
  {
    name: "render_plantuml",
    description:
      "渲染 PlantUML 源码为 SVG 图片（无损矢量格式，可无限缩放）。输入完整的 @startuml...@enduml 源码，返回 base64 SVG data URI。语法错误时返回错误信息。",
    inputSchema: {
      type: "object",
      properties: {
        source: {
          type: "string",
          description:
            "完整的 PlantUML 源码，以 @startuml 开头、@enduml 结尾。",
        },
        background: {
          type: "string",
          description:
            "可选。SVG 背景色（十六进制，如 '#ffffff'）。暗色主题下建议传 '#ffffff' 保证可读；传 'none' 或不传则保持透明背景。",
        },
      },
      required: ["source"],
    },
  },
];

// ============ PlantUML 官方 encodeurl 编码 ============
// 源码 → deflateRaw 压缩 → 自定义 base64（字母表与 PlantUML 一致）
const CODE6 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function encode6bit(b) {
  return CODE6.charAt(b & 0x3f);
}

function append3bytes(b1, b2, b3) {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  return encode6bit(c1) + encode6bit(c2) + encode6bit(c3) + encode6bit(c4);
}

function encode64(data) {
  let r = "";
  for (let i = 0; i < data.length; i += 3) {
    if (i + 2 === data.length) r += append3bytes(data[i], data[i + 1], 0);
    else if (i + 1 === data.length) r += append3bytes(data[i], 0, 0);
    else r += append3bytes(data[i], data[i + 1], data[i + 2]);
  }
  return r;
}

function encodePlantUML(source) {
  return encode64(deflateRawSync(Buffer.from(source, "utf-8")));
}

// ============ 常驻 HTTP 服务器生命周期（模块私有状态） ============
const HTTP_PORT = 18080;
const HTTP_BASE = `http://localhost:${HTTP_PORT}`;
let httpServer = null; // spawn 的 http-server 子进程
let httpReady = false; // 端口是否已就绪
let httpStarting = false; // 是否正在启动中（防重复拉起）

/**
 * 启动常驻 plantuml http-server（JVM 只启动一次）
 * 异步轮询端口就绪，不阻塞 MCP 握手
 */
export async function ensurePlantumlHttpServer() {
  if (httpReady || httpStarting) return;
  httpStarting = true;

  try {
    // 检查端口是否已被其他 plantuml 服务器占用（多实例复用）
    const probe = await fetch(`${HTTP_BASE}/`, { signal: AbortSignal.timeout(1000) });
    if (probe.ok) {
      httpReady = true;
      return;
    }
  } catch {
    // 端口未占用，继续启动
  }

  httpServer = spawn("plantuml", ["--http-server:" + String(HTTP_PORT)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  httpServer.stderr.on("data", () => {}); // 静默吞掉日志
  httpServer.on("exit", () => {
    httpReady = false;
    httpServer = null;
  });

  // 轮询端口就绪（最长 10 秒）
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const probe = await fetch(`${HTTP_BASE}/`, { signal: AbortSignal.timeout(500) });
      if (probe.ok) {
        httpReady = true;
        return;
      }
    } catch {
      // 未就绪，继续等
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  // 超时：回退 CLI，不抛出
  httpReady = false;
}

/**
 * 通过 HTTP 渲染（GET /svg/<encoded>）
 */
async function renderViaHttp(source) {
  const encoded = encodePlantUML(source);
  const resp = await fetch(`${HTTP_BASE}/svg/${encoded}`, {
    signal: AbortSignal.timeout(15000),
  });
  const buf = Buffer.from(await resp.arrayBuffer());
  if (resp.status !== 200) {
    return {
      success: false,
      error: `PlantUML 渲染错误 (HTTP ${resp.status})`,
    };
  }
  return {
    success: true,
    svgText: buf.toString("utf-8"),
  };
}

/**
 * 通过 CLI 渲染（-pipe -tsvg），作为 HTTP 模式的回退
 */
function renderViaCli(source) {
  return new Promise((resolve, reject) => {
    const proc = spawn("plantuml", ["-pipe", "-tsvg"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => {
      stdout += data.toString("utf-8");
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      resolve({
        success: false,
        error: `plantuml 执行失败: ${err.message}`,
      });
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: stderr.trim() || `plantuml 退出码 ${code}`,
        });
        return;
      }
      if (!stdout.trim()) {
        resolve({
          success: false,
          error: "plantuml 未输出 SVG 内容",
        });
        return;
      }
      resolve({ success: true, svgText: stdout });
    });

    proc.stdin.write(source, "utf-8");
    proc.stdin.end();
  });
}

// ============ SVG 背景后处理 ============
// PlantUML 通过 SVG 根元素 CSS background 设置白底，但 librsvg（Emacs image-mode 渲染器）
// 不支持该 CSS 属性，导致实际渲染为透明背景（暗色主题下黑字不可读）。
// 方案：注入标准 <rect> 背景元素（所有渲染器支持），作为 svg 首个子元素（最底层）。
const SVG_BACKGROUND_RE = /^#[0-9a-fA-F]{3,8}$/;

/**
 * 在 SVG 中注入背景矩形。background 为合法十六进制色值才注入；
 * 'none' / 非法值 / 缺省 → 不注入（保持透明，向后兼容）。
 */
function applySvgBackground(svgText, background) {
  if (!background || background === "none" || !SVG_BACKGROUND_RE.test(background)) {
    return svgText;
  }
  const rect = `<rect width="100%" height="100%" fill="${background}"/>`;
  return svgText.replace(/<svg[^>]*>/, (m) => m + rect);
}

/**
 * 渲染 PlantUML 源码为 SVG（优先 HTTP，回退 CLI）。
 * background：可选背景色（十六进制），见 applySvgBackground。
 */
async function renderPlantuml(source, background) {
  // 尝试 HTTP 模式（常驻服务器复用 JVM）
  if (httpReady) {
    try {
      const result = await renderViaHttp(source);
      if (result.success) {
        result.svgText = applySvgBackground(result.svgText, background);
        return result;
      }
      // HTTP 返回错误（如语法错误 400），直接返回错误而非回退 CLI
      return result;
    } catch {
      // HTTP 请求失败（服务器崩溃等），标记不可用并回退 CLI
      httpReady = false;
      if (httpServer) {
        httpServer.kill();
        httpServer = null;
      }
    }
  }

  // 回退 CLI 模式
  const result = await renderViaCli(source);
  if (result.success) {
    result.svgText = applySvgBackground(result.svgText, background);
  }
  return result;
}

// ============ 生命周期清理 ============
export function cleanupPlantuml() {
  if (httpServer) {
    httpServer.kill();
    httpServer = null;
  }
  httpReady = false;
}

// ============ 工具调用分发 ============
export async function handlePlantumlCall(name, args) {
  if (name !== "render_plantuml") {
    return {
      content: [{ type: "text", text: `未知工具: ${name}` }],
      isError: true,
    };
  }

  const source = args?.source;
  if (!source || typeof source !== "string") {
    return {
      content: [{ type: "text", text: "缺少必需参数 source" }],
      isError: true,
    };
  }

  const background = args?.background;
  const result = await renderPlantuml(source, background);

  if (result.success) {
    return {
      content: [
        {
          type: "text",
          text: "PlantUML 渲染成功。SVG 图片已通过 image 内容返回（无损矢量格式）。",
        },
        {
          type: "image",
          data: Buffer.from(result.svgText, "utf-8").toString("base64"),
          mimeType: "image/svg+xml",
        },
      ],
    };
  }
  return {
    content: [{ type: "text", text: `⚠️ PlantUML 渲染失败:\n${result.error}` }],
    isError: true,
  };
}
