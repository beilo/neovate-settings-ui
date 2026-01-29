# provider

**类型:** `Record<string, ProviderConfig>`  
**默认值:** `{}`

## 说明

覆盖特定提供商的默认设置。可配置 API 密钥、端点等。

ProviderConfig 包含：
- `apiKey`: API 密钥
- `baseUrl`: 自定义 API 端点（用于代理或自部署）

## 使用示例

```json
{
  "provider": {
    "anthropic": {
      "apiKey": "sk-ant-xxx"
    },
    "openai": {
      "apiKey": "sk-xxx",
      "baseUrl": "https://api.openai-proxy.com/v1"
    }
  }
}
```

## 相关配置

- model: 主模型设置
- httpProxy: HTTP 代理
