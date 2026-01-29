# smallModel

**类型:** `string`  
**默认值:** 与 `model` 相同

## 说明

指定用于简单任务的轻量模型。如果未设置，将使用主模型 (model)。

轻量模型用于快速响应、简单查询等不需要复杂推理的场景，可节省成本。

## 使用示例

```json
{
  "smallModel": "anthropic/claude-3-haiku-20240307"
}
```

## 相关配置

- model: 主模型
- planModel: 规划模型
