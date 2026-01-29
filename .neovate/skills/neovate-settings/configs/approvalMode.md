# approvalMode

**类型:** `"autoEdit" | "yolo" | "default"`  
**默认值:** `"default"`

## 说明

控制 Neovate 的审批模式：
- `default`: 每次操作前需要用户确认
- `autoEdit`: 自动执行编辑操作，但其他操作仍需确认
- `yolo`: 完全自动执行，无需确认（谨慎使用）

## 使用示例

```json
{
  "approvalMode": "autoEdit"
}
```

## 相关配置

- tools: 可配合使用，控制哪些工具可用
