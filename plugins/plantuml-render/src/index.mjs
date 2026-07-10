#!/usr/bin/env node

// PlantUML 渲染 MCP 服务器
// 提供 render_plantuml 工具：接受 PlantUML 源码，渲染为 PNG，返回 base64 data URI

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "node:child_process";
import { writeFile, readFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const TOOL_NAME = "render_plantuml";

const TOOL_DEFINITION = {
  name: TOOL_NAME,
  description:
    "渲染 PlantUML 源码为 PNG 图片。输入完整的 @startuml...@enduml 源码，返回 base64 PNG data URI。语法错误时返回错误信息。",
  inputSchema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        description:
          "完整的 PlantUML 源码，以 @startuml 开头、@enduml 结尾。",
      },
    },
    required: ["source"],
  },
};

/**
 * 渲染 PlantUML 源码为 PNG base64
 * 通过临时文件传递源码，避免 shell 注入风险
 */
async function renderPlantuml(source) {
  const tmpDir = join(tmpdir(), "eca-plantuml");
  await mkdir(tmpDir, { recursive: true });

  const id = randomUUID();
  const pumlPath = join(tmpDir, `${id}.puml`);
  const pngPath = join(tmpDir, `${id}.png`);

  try {
    // 写入临时文件
    await writeFile(pumlPath, source, "utf-8");

    // 调用 plantuml CLI 渲染
    return await new Promise((resolve, reject) => {
      const proc = spawn("plantuml", ["-tpng", pumlPath], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stderr = "";
      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", async (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: stderr.trim() || `plantuml 退出码 ${code}`,
          });
          return;
        }

        try {
          const pngData = await readFile(pngPath);
          const base64 = pngData.toString("base64");
          resolve({
            success: true,
            dataUri: `data:image/png;base64,${base64}`,
          });
        } catch (err) {
          resolve({
            success: false,
            error: `读取 PNG 失败: ${err.message}`,
          });
        }
      });

      proc.on("error", (err) => {
        resolve({
          success: false,
          error: `plantuml 执行失败: ${err.message}`,
        });
      });
    });
  } finally {
    // 清理临时文件
    await unlink(pumlPath).catch(() => {});
    await unlink(pngPath).catch(() => {});
  }
}

// 创建 MCP 服务器
const server = new Server(
  { name: "plantuml-render", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [TOOL_DEFINITION],
}));

// 注册工具调用处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name !== TOOL_NAME) {
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

  const result = await renderPlantuml(source);

  if (result.success) {
    return {
      content: [
        {
          type: "text",
          text: "PlantUML 渲染成功。图片已通过 image 内容返回。",
        },
        {
          type: "image",
          data: result.dataUri.replace("data:image/png;base64,", ""),
          mimeType: "image/png",
        },
      ],
    };
  } else {
    return {
      content: [{ type: "text", text: `⚠️ PlantUML 渲染失败:\n${result.error}` }],
      isError: true,
    };
  }
});

// 启动服务器
const transport = new StdioServerTransport();
await server.connect(transport);
