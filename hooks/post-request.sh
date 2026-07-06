#!/usr/bin/env bash
# PlantUML L3 post-request Hook
# 响应完成后扫描 prompt 中的 PlantUML 残留块
# stdin: JSON {hook_name, hook_type, chat_id, agent, prompt, workspaces, db_cache_path}
# stdout: JSON {systemMessage, additionalContext}

set -euo pipefail

INPUT=$(cat)

# 提取 prompt 字段
PROMPT=$(echo "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('prompt',''))" 2>/dev/null || echo "$INPUT")

# 统计 @startuml 和 @enduml 出现次数
# grep -c 在匹配数为 0 时退出码为 1，用 || true 覆盖退出码但不追加额外输出
STARTUML_COUNT=$(echo "$PROMPT" | grep -c '@startuml' 2>/dev/null || true)
ENDUML_COUNT=$(echo "$PROMPT" | grep -c '@enduml' 2>/dev/null || true)

if [ "$STARTUML_COUNT" -gt 0 ] || [ "$ENDUML_COUNT" -gt 0 ]; then
  SYSTEM_MSG="⚠️ 检测到响应中存在 PlantUML 代码块：@startuml 出现 ${STARTUML_COUNT} 次，@enduml 出现 ${ENDUML_COUNT} 次。模型未能自动渲染为图片。请提示 Agent 调用 render_plantuml 工具重新生成图片。"
  python3 -c "
import sys, json
msg = '''${SYSTEM_MSG}'''
print(json.dumps({'systemMessage': msg}))
" 2>/dev/null || echo "{\"systemMessage\": \"${SYSTEM_MSG}\"}"
else
  # 无残留，静默退出
  echo '{}'
fi
