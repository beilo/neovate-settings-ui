# planModel

**类型:** `string`  
**默认值:** 与 `model` 相同

## 说明

指定用于规划任务的模型。如果未设置，将使用主模型 (model)。

规划模型用于任务分解、方案设计等需要系统思考的场景。

## 使用示例

```json
{
  "planModel": "anthropic/claude-opus-4-20250514"
}
```

## 相关配置

- model: 主模型
- smallModel: 轻量模型
