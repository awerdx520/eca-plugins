#!/usr/bin/env node

// Pandoc 文档转换 MCP 服务器
// 提供 pandoc_convert 和 pandoc_list_formats 工具

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

// ── 工具定义 ──

const TOOLS = [
  {
    name: "pandoc_convert",
    description:
      "使用 pandoc 在文档格式之间转换。支持 Markdown、Org、HTML、LaTeX、DOCX 等格式。传入源文本、源格式和目标格式，返回转换后的内容。",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "要转换的源文本内容",
        },
        from: {
          type: "string",
          description: "源格式（如 markdown、org、html、latex、docx）",
        },
        to: {
          type: "string",
          description: "目标格式（如 markdown、org、html、latex、docx、pdf）",
        },
        options: {
          type: "array",
          items: { type: "string" },
          description: "可选的 pandoc CLI 参数列表，如 [\"--standalone\", \"--toc\"]。参数直接传给 pandoc，不做安全过滤。",
        },
      },
      required: ["content", "from", "to"],
    },
  },
  {
    name: "pandoc_list_formats",
    description:
      "列出 pandoc 支持的所有输入和输出格式。用于了解可以进行哪些格式转换。",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ── 工具实现 ──

/**
 * 文档格式转换
 * 通过临时文件传递内容，避免 shell 注入
 */
async function pandocConvert(content, from, to, options) {
  const tmpDir = join(tmpdir(), "eca-pandoc");
  await mkdir(tmpDir, { recursive: true });

  const id = randomUUID();
  const inputPath = join(tmpDir, `${id}.input`);
  const outputPath = join(tmpDir, `${id}.output`);

  try {
    // 写入源内容到临时文件
    await writeFile(inputPath, content, "utf-8");

    // 调用 pandoc 转换
    return await new Promise((resolve) => {
      const pandocArgs = [
        "-f", from,
        "-t", to,
        inputPath,
        "-o", outputPath,
      ];
      // 将 options 插入到输出文件参数之前
      if (options && Array.isArray(options) && options.length > 0) {
        pandocArgs.splice(pandocArgs.length - 2, 0, ...options);
      }
      const proc = spawn("pandoc", pandocArgs,
        { stdio: ["ignore", "pipe", "pipe"] }
      );

      let stderr = "";
      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", async (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: stderr.trim() || `pandoc 退出码 ${code}`,
          });
          return;
        }

        try {
          const output = await readFile(outputPath, "utf-8");
          resolve({
            success: true,
            content: output,
          });
        } catch (err) {
          resolve({
            success: false,
            error: `读取输出文件失败: ${err.message}`,
          });
        }
      });

      proc.on("error", (err) => {
        resolve({
          success: false,
          error: `pandoc 执行失败: ${err.message}`,
        });
      });
    });
  } finally {
    // 清理临时文件
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

/**
 * 列出 pandoc 支持的格式
 */
async function listFormats() {
  const runPandoc = (args) =>
    new Promise((resolve, reject) => {
      const proc = spawn("pandoc", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      proc.stdout.on("data", (d) => (stdout += d.toString()));
      proc.stderr.on("data", (d) => (stderr += d.toString()));
      proc.on("close", (code) => {
        if (code !== 0) reject(new Error(stderr || `退出码 ${code}`));
        else resolve(stdout.trim().split("\n").filter(Boolean));
      });
      proc.on("error", reject);
    });

  try {
    const [input, output] = await Promise.all([
      runPandoc(["--list-input-formats"]),
      runPandoc(["--list-output-formats"]),
    ]);
    return { success: true, input, output };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── MCP 服务器 ──

const server = new Server(
  { name: "pandoc-convert", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// 工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// 工具调用分发
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "pandoc_convert": {
      const { content, from, to, options } = args || {};
      if (!content || typeof content !== "string") {
        return {
          content: [{ type: "text", text: "缺少必需参数 content" }],
          isError: true,
        };
      }
      if (!from || typeof from !== "string") {
        return {
          content: [{ type: "text", text: "缺少必需参数 from" }],
          isError: true,
        };
      }
      if (!to || typeof to !== "string") {
        return {
          content: [{ type: "text", text: "缺少必需参数 to" }],
          isError: true,
        };
      }

      const result = await pandocConvert(content, from, to, options);
      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: `文档转换成功 (${from} → ${to}):\n\n${result.content}`,
            },
          ],
        };
      }
      return {
        content: [{ type: "text", text: `⚠️ Pandoc 转换失败:\n${result.error}` }],
        isError: true,
      };
    }

    case "pandoc_list_formats": {
      const result = await listFormats();
      if (result.success) {
        const text = [
          `## Pandoc 支持的输入格式（${result.input.length} 种）`,
          "",
          ...result.input.map((f) => `- ${f}`),
          "",
          `## Pandoc 支持的输出格式（${result.output.length} 种）`,
          "",
          ...result.output.map((f) => `- ${f}`),
        ].join("\n");
        return { content: [{ type: "text", text }] };
      }
      return {
        content: [{ type: "text", text: `⚠️ 获取格式列表失败:\n${result.error}` }],
        isError: true,
      };
    }

    default:
      return {
        content: [{ type: "text", text: `未知工具: ${name}` }],
        isError: true,
      };
  }
});

// 启动
const transport = new StdioServerTransport();
await server.connect(transport);
