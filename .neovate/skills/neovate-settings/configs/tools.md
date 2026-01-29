# tools

**类型:** `Record<string, boolean>`  
**默认值:** `{}`

## 说明

配置特定工具的开关状态。可以禁用某些工具以限制 Neovate 的能力。

常用工具：
- `bash`: 执行 shell 命令
- `read`: 读取文件
- `write`: 写入文件
- `edit`: 编辑文件
- `grep`: 搜索代码
- `glob`: 文件匹配

## 使用示例

```json
{
  "tools": {
    "bash": false,
    "write": true
  }
}
```

## 相关配置

- approvalMode: 审批模式
- mcpServers: MCP 工具
