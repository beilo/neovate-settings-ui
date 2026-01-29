# skills

**类型:** `string[]`  
**默认值:** `[]`

## 说明

指定额外的 SKILL.md 文件或文件夹路径。Skills 可以为 Neovate 提供特定领域的知识和行为指南。

支持：
- 单个 SKILL.md 文件路径
- 包含 SKILL.md 的目录路径

## 使用示例

```json
{
  "skills": [
    "~/.neovate/skills/my-custom-skill",
    "/path/to/project/.neovate/skills"
  ]
}
```

## 相关配置

- systemPrompt: 自定义系统提示
