#!/usr/bin/env node

// eca-common-tools 统一 MCP 服务器
// 聚合 render_plantuml（PlantUML SVG 渲染）、pandoc_convert / pandoc_list_formats（文档转换）
// 模块化架构：新增工具 = 新建 src/*.mjs 模块 + 在本文件注册 TOOLS/HANDLERS 两行

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  plantumlTools,
  ensurePlantumlHttpServer,
  cleanupPlantuml,
  handlePlantumlCall,
} from "./plantuml.mjs";
import {
  pandocTools,
  handlePandocCall,
} from "./pandoc.mjs";
import {
  utilTools,
  handleUtilCall,
} from "./util.mjs";

// ============ 工具注册表（聚合所有工具定义） ============
const ALL_TOOLS = [...plantumlTools, ...pandocTools, ...utilTools];

// ============ 工具分发器（按工具名路由到对应模块处理器） ============
const HANDLERS = {
  render_plantuml: handlePlantumlCall,
  plantuml_validate: handlePlantumlCall,
  pandoc_convert: handlePandocCall,
  pandoc_list_formats: handlePandocCall,
  json_format: handleUtilCall,
  csv_to_markdown: handleUtilCall,
  regex_test: handleUtilCall,
};

// ============ MCP 服务器 ============
const server = new Server(
  { name: "eca-common-tools", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS,
}));

// 注册工具调用处理（分发到模块处理器）
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const handler = HANDLERS[name];
  if (!handler) {
    return {
      content: [{ type: "text", text: `未知工具: ${name}` }],
      isError: true,
    };
  }
  return await handler(name, args);
});

// ============ 生命周期接线 ============
function cleanup() {
  cleanupPlantuml();
  process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

// 启动 MCP 服务器，并异步拉起常驻 plantuml http-server
const transport = new StdioServerTransport();
await server.connect(transport);
ensurePlantumlHttpServer();
