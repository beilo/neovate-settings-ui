# visionModel

**类型:** `string`  
**默认值:** 与 `model` 相同

## 说明

选择用于图像相关任务的模型。如果未设置，将使用主模型 (model)。

确保所选模型支持视觉/多模态能力。

## 使用示例

```json
{
  "visionModel": "anthropic/claude-sonnet-4-20250514"
}
```

支持视觉的常用模型：
- `anthropic/claude-sonnet-4-20250514`
- `openai/gpt-4o`

## 相关配置

- model: 主模型
- smallModel: 轻量模型
