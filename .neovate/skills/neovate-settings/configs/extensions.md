# extensions

**类型:** `Record<string, any>`  
**默认值:** `{}`

## 说明

处理第三方自定义代理的扩展配置。允许为第三方扩展传递自定义配置项。

## 使用示例

```json
{
  "extensions": {
    "my-custom-extension": {
      "apiKey": "xxx",
      "endpoint": "https://api.example.com"
    }
  }
}
```

## 相关配置

- plugins: 插件列表
