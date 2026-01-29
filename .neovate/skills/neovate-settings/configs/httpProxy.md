# httpProxy

**类型:** `string`  
**默认值:** `null`

## 说明

设置网络请求的 HTTP 代理。适用于需要通过代理访问 API 的场景。

支持格式：
- `http://host:port`
- `http://user:password@host:port`

## 使用示例

```json
{
  "httpProxy": "http://127.0.0.1:7890"
}
```

## 相关配置

- provider: 提供商配置可能也需要代理
