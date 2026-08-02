# ECA 插件仓库

ECA（Editor Code Assistant）插件集，提供统一的工具能力：PlantUML 图形渲染（SVG 无损矢量）、文档格式转换等。

## 已收录插件

| 插件 | 版本 | 说明 |
|------|------|------|
| [eca-common-tools](./plugins/eca-common-tools/Readme.org) | 0.1.0 | 统一工具集：render_plantuml（PlantUML SVG 无损渲染，支持 background 背景色参数）、pandoc_convert 与 pandoc_list_formats（文档格式转换），一个 MCP 服务器包含全部工具 |

## 安装

在 ECA 配置文件（`~/.config/eca/config.json`）中添加插件源：

```json
{
  "plugins": {
    "plantuml": {
      "source": "https://github.com/thomas/eca-plugins.git"
    },
    "install": ["eca-common-tools"]
  }
}
```

本地开发方式：

```json
{
  "plugins": {
    "local-dev": {
      "source": "/home/thomas/Workspace/eca-plugins"
    },
    "install": ["eca-common-tools"]
  }
}
```

重启 ECA 后生效。

## 仓库结构

```
eca-plugins/
├── .eca-plugin/
│   └── marketplace.json       # 插件市场注册
├── plugins/
│   └── eca-common-tools/      # eca-common-tools 插件
│       ├── eca.json           # 插件元数据
│       ├── .mcp.json          # MCP 服务器注册
│       ├── hooks/             # pre-request + post-request
│       ├── skills/            # agent skill (agentskills.io)
│       └── src/               # MCP 服务器源码
├── CHANGELOG.md               # 变更日志
└── README.md                  # 本文件
```

## 贡献

欢迎提交 PR。插件开发规范请参考 [ECA 插件文档](https://eca.dev/config/plugins/)。

## 许可证

MIT
