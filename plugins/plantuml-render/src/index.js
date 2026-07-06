#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

/**
 * 渲染 PlantUML 源码为 base64 PNG 图片
 */
function renderPlantUml(source) {
  const tempPrefix = "plantuml-" + randomBytes(6).toString("hex");
  const pumlPath = join(tmpdir(), tempPrefix + ".puml");

  try {
    writeFileSync(pumlPath, source, "utf-8");
    execSync(`plantuml -tpng "${pumlPath}"`, {
      stdio: "pipe",
      timeout: 15000,
    });
    const pngPath = pumlPath.replace(/\.puml$/, ".png");
    const imageBytes = readFileSync(pngPath);
    const base64 = imageBytes.toString("base64");
    // 清理临时文件
    try { unlinkSync(pumlPath); } catch (_) {}
    try { unlinkSync(pngPath); } catch (_) {}
    return { success: true, base64, mediaType: "image/png" };
  } catch (err) {
    // 清理临时文件（出错时也清理）
    try { unlinkSync(pumlPath); } catch (_) {}
    const pngPath = pumlPath.replace(/\.puml$/, ".png");
    try { unlinkSync(pngPath); } catch (_) {}
    return { success: false, error: err.stderr?.toString() || err.message };
  }
}

// 创建 MCP Server
const server = new Server(
  { name: "plantuml-render", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "render_plantuml",
      description:
        "将 PlantUML 源码渲染为 PNG 图片。输入 @startuml...@enduml 格式的源码，返回 base64 编码的 PNG 图片，可直接在 ECA 客户端渲染。用于架构图、流程图、时序图等任何需要图形化展示的场景。",
      inputSchema: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description:
              "完整的 PlantUML 源码，必须以 @startuml 开始、以 @enduml 结束。例如：@startuml\\nAlice -> Bob : Hello\\n@enduml",
          },
        },
        required: ["source"],
      },
    },
  ],
}));

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "render_plantuml") {
    const source = request.params.arguments?.source || "";
    if (!source.trim()) {
      return {
        content: [{ type: "text", text: "错误：PlantUML 源码为空" }],
        isError: true,
      };
    }
    const result = renderPlantUml(source);
    if (result.success) {
      return {
        content: [
          { type: "image", data: result.base64, mimeType: result.mediaType },
          { type: "text", text: "✅ PlantUML 已渲染为图片" },
        ],
      };
    } else {
      return {
        content: [
          {
            type: "text",
            text: `❌ PlantUML 渲染失败：${result.error}`,
          },
        ],
        isError: true,
      };
    }
  }
  throw new Error(`未知工具：${request.params.name}`);
});

// 启动服务
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("plantuml-mcp-server 已启动");
}

main().catch((err) => {
  console.error("启动失败:", err);
  process.exit(1);
});
