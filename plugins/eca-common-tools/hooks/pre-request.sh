#!/usr/bin/env bash
# PlantUML L1 pre-request Hook
# 每次 LLM 请求前，在 prompt 中注入 PlantUML 画图规则
# 注意：只注入规则说明，不注入工具调用指令（渲染由 post-request hook 处理）
# stdin: JSON {hook_name, hook_type, chat_id, agent, prompt, workspaces, db_cache_path}
# stdout: JSON {replacedPrompt: "增强后的prompt", ...}

set -euo pipefail

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('prompt',''))" 2>/dev/null || echo "")

# 从 rules.md 读取 PlantUML 画图规则（不含工具调用指令）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RULES_FILE="${SCRIPT_DIR}/rules.md"
if [ -f "$RULES_FILE" ]; then
  INJECTION=$(cat "$RULES_FILE")
else
  INJECTION=""
fi

# 检查 prompt 是否已包含渲染指令（避免重复注入）
if echo "$PROMPT" | grep -q "PlantUML 图形绘制规则（ECA 插件自动注入）"; then
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
