# desktop

**类型:** `object`  
**默认值:** `{ theme: "light", sendMessageWith: "enter" }`

## 说明

管理桌面应用的偏好设置。

可用属性：
- `theme`: 主题（"light" | "dark"）
- `sendMessageWith`: 发送消息的快捷键（"enter" | "shift+enter"）

## 使用示例

```json
{
  "desktop": {
    "theme": "dark",
    "sendMessageWith": "shift+enter"
  }
}
```

## 相关配置

- language: 界面语言
