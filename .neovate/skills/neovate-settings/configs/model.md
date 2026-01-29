# model

**类型:** `string`  
**默认值:** `null`

## 说明

指定主模型，使用 `provider_id/model_id` 格式。

这是 Neovate 默认使用的模型，用于大多数任务。

## 使用示例

```json
{
  "model": "anthropic/claude-sonnet-4-20250514"
}
```

常用模型：
- `anthropic/claude-sonnet-4-20250514`
- `anthropic/claude-opus-4-20250514`
- `openai/gpt-4o`
- `openai/o1`

## 相关配置

- smallModel: 轻量任务使用的模型
- planModel: 规划任务使用的模型
- visionModel: 视觉任务使用的模型
- provider: 提供商配置
