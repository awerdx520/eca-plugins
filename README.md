# ECA PlantUML 插件仓库

PlantUML 渲染插件集，为 ECA（Editor Code Assistant）提供 PlantUML 图形的自动渲染能力。

## 已收录插件

| 插件 | 版本 | 说明 |
|------|------|------|
| [plantuml-render](./plugins/plantuml-render/Readme.org) | 0.1.0 | 自动将对话中的 PlantUML 源码渲染为 PNG 图片（base64 内联），在 ECA 客户端直接显示图形 |

## 安装

在 ECA 配置文件（`~/.config/eca/config.json`）中添加插件源：

```json
{
  "plugins": {
    "plantuml": {
      "source": "https://github.com/thomas/eca-plugins.git"
    },
    "install": ["plantuml-render"]
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
    "install": ["plantuml-render"]
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
│   └── plantuml-render/       # plantuml-render 插件
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
