# autoCompact

**类型:** `boolean`  
**默认值:** `true`

## 说明

开启或关闭自动紧凑功能。当禁用时，对话历史可能会持续累积，可能导致 token 使用量增加。

建议保持开启以优化 token 消耗。

## 使用示例

```json
{
  "autoCompact": true
}
```

## 相关配置

- model: 使用的模型会影响 token 上限
