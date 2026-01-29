# agent

**类型:** `Record<string, AgentConfig>`  
**默认值:** `{}`

## 说明

配置特定的代理类型（子代理），允许为不同的代理设置独立的模型。

AgentConfig 包含：
- `model`: 该代理使用的模型

## 使用示例

```json
{
  "agent": {
    "code-reviewer": {
      "model": "anthropic/claude-sonnet-4-20250514"
    },
    "task": {
      "model": "openai/gpt-4o"
    }
  }
}
```

## 相关配置

- model: 主模型设置
- smallModel: 轻量任务模型
