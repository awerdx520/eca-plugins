#!/usr/bin/env bash
# PlantUML L1 pre-request Hook
# 每次 LLM 请求前，在 prompt 中注入 render_plantuml 调用指令
# stdin: JSON {hook_name, hook_type, chat_id, agent, prompt, workspaces, db_cache_path}
# stdout: JSON {replacedPrompt: "增强后的prompt", ...}

set -euo pipefail

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('prompt',''))" 2>/dev/null || echo "")

# 要注入的 PlantUML 渲染指令
INJECTION=$'\n\n---\n## PlantUML 渲染指令（ECA 自动注入）\n\n当你输出 PlantUML 图形时，请遵守以下规则：\n\n1. **禁止只输出 PlantUML 代码块。** 必须调用 `render_plantuml` MCP 工具将源码转换为图片。\n2. 对于每个 `@startuml...@enduml` 块，按以下步骤操作：\n   - 第一步：输出 PlantUML 源码作为代码块（供文本查看）\n   - 第二步：**立即调用 `render_plantuml` 工具**，将源码作为 `source` 参数传入\n3. 工具返回 PNG 图片后，图片会自动在对话中渲染显示。\n4. 如果工具调用失败（如语法错误），提示用户修复 PlantUML 源码。\n\n---'

# 检查 prompt 是否已包含渲染指令（避免重复注入）
if echo "$PROMPT" | grep -q "render_plantuml"; then
  # 已含指令，不重复注入
  echo "$INPUT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
prompt = d.get('prompt', '')
print(json.dumps({'replacedPrompt': prompt}))
" 2>/dev/null || echo "{\"replacedPrompt\": \"${PROMPT}\"}"
else
  # 注入指令
  NEW_PROMPT="${PROMPT}${INJECTION}"
  # 安全地输出 JSON（使用 python 保证转义正确）
  python3 -c "
import sys, json
new_prompt = sys.argv[1] if len(sys.argv) > 1 else ''
print(json.dumps({'replacedPrompt': new_prompt}))
" "$NEW_PROMPT" 2>/dev/null || {
    # Python 不可用时的回退：手动转义
    ESCAPED=$(echo "$NEW_PROMPT" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' ')
    echo "{\"replacedPrompt\": \"$ESCAPED\"}"
  }
fi
