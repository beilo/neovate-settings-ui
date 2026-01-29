# mcpServers

**类型:** `Record<string, McpServerConfig>`  
**默认值:** `{}`

## 说明

配置 MCP (Model Context Protocol) 服务器列表。MCP 允许 Neovate 连接外部工具和服务。

McpServerConfig 包含：
- `command`: 启动命令
- `args`: 命令参数
- `env`: 环境变量

## 使用示例

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "your-token"
      }
    }
  }
}
```

## 相关配置

- browser: 浏览器 MCP 集成
- tools: 工具开关
