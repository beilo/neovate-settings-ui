# Skills 安装流程总结

## 整体流程

```
用户执行 npx skills add <source>
         ↓
    解析来源类型
         ↓
    克隆到 /tmp/skills-xxx/
         ↓
    扫描发现技能 (SKILL.md)
         ↓
    复制到 ~/.agents/skills/<name>/
         ↓
    创建 symlink 到各 agent 目录
         ↓
    删除临时目录
         ↓
    更新 .skill-lock.json
```

## 关键方法/文件

| 步骤 | 文件 | 方法 |
|------|------|------|
| CLI 入口 | `cli.ts` | `main()` |
| 解析来源 | `source-parser.ts` | `parseSource()` |
| 克隆仓库 | `git.ts` | `cloneRepo()` |
| 发现技能 | `skills.ts` | `discoverSkills()` |
| 安装到 canonical | `installer.ts` | `installSkillForAgent()` |
| 创建软链接 | `installer.ts` | `createSymlink()` |
| 清理临时目录 | `git.ts` | `cleanupTempDir()` |
| 更新锁文件 | `skill-lock.ts` | `writeLockFile()` |

## 目录结构

| 路径 | 用途 |
|------|------|
| `/tmp/skills-xxx/` | 临时下载 |
| `~/.agents/skills/<name>/` | canonical（真实存储） |
| `~/<agent>/skills/<name>/` | 软链接（各 agent 使用） |
| `~/.agents/.skill-lock.json` | 锁文件 |

## Symlink 策略

- 默认 symlink，失败回退 copy
- Windows 用 `junction`，Unix 用普通 symlink
- 使用相对路径创建链接
