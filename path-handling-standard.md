# 路径处理实现标准

> 基于 vercel-labs/skills 项目的路径处理机制总结

## 1. 依赖模块

```typescript
import { join, basename, normalize, resolve, sep, relative, dirname } from 'path';
import { homedir, platform, tmpdir } from 'os';
```

## 2. 基础目录获取

### 2.1 用户主目录

```typescript
const home = homedir();
// macOS: /Users/username
// Linux: /home/username
// Windows: C:\Users\username
```

### 2.2 全局 vs 项目级别

```typescript
function getBaseDir(global: boolean, cwd?: string): string {
  return global ? homedir() : cwd || process.cwd();
}
```

### 2.3 支持环境变量覆盖

```typescript
const customHome = process.env.MY_APP_HOME?.trim() || join(homedir(), '.myapp');
```

## 3. 跨平台适配

### 3.1 路径分隔符

**不要硬编码 `/` 或 `\`**，使用 `path.sep` 或 `path.join()`：

```typescript
// ✅ 正确
join(home, '.agents', 'skills');
path.startsWith(base + sep);

// ❌ 错误
home + '/.agents/skills';
path.startsWith(base + '/');
```

### 3.2 Symlink 类型

```typescript
import { symlink } from 'fs/promises';
import { platform } from 'os';

async function createSymlink(target: string, linkPath: string): Promise<boolean> {
  try {
    const relativePath = relative(dirname(linkPath), target);
    const symlinkType = platform() === 'win32' ? 'junction' : undefined;
    await symlink(relativePath, linkPath, symlinkType);
    return true;
  } catch {
    return false;
  }
}
```

| 平台 | symlinkType | 说明 |
|------|-------------|------|
| Windows | `'junction'` | 不需要管理员权限，仅支持目录 |
| macOS/Linux | `undefined` | 使用默认 symlink |

### 3.3 Symlink 失败回退

```typescript
const symlinkCreated = await createSymlink(canonicalDir, agentDir);
if (!symlinkCreated) {
  // 回退为复制文件
  await cp(source, dest, { recursive: true });
}
```

## 4. 路径安全校验（防目录穿越）

```typescript
function isPathSafe(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalize(resolve(basePath));
  const normalizedTarget = normalize(resolve(targetPath));
  return normalizedTarget.startsWith(normalizedBase + sep) || 
         normalizedTarget === normalizedBase;
}

// 使用示例
if (!isPathSafe(baseDir, userProvidedPath)) {
  throw new Error('Invalid path: potential path traversal detected');
}
```

## 5. 名称清洗（用于目录名）

```typescript
function sanitizeName(name: string): string {
  const sanitized = name
    .toLowerCase()
    // 非法字符替换为连字符
    .replace(/[^a-z0-9._]+/g, '-')
    // 去除首尾的点和连字符
    .replace(/^[.\-]+|[.\-]+$/g, '');
  
  // 限制长度，提供默认值
  return sanitized.substring(0, 255) || 'unnamed';
}
```

## 6. 路径规范化

```typescript
// 解析为绝对路径并规范化
const safePath = normalize(resolve(inputPath));

// 计算相对路径（用于 symlink）
const relativePath = relative(fromDir, toPath);

// 解析 symlink 目标的实际路径
function resolveSymlinkTarget(linkPath: string, linkTarget: string): string {
  return resolve(dirname(linkPath), linkTarget);
}
```

## 7. 临时目录

```typescript
import { tmpdir } from 'os';
import { mkdtemp } from 'fs/promises';

async function createTempDir(prefix: string): Promise<string> {
  return await mkdtemp(join(tmpdir(), prefix));
}
// 返回: /tmp/skills-xxx/ (Unix) 或 C:\Users\xxx\AppData\Local\Temp\skills-xxx\ (Windows)
```

## 8. 目录结构约定

```
~/                                    # homedir()
├── .agents/
│   ├── skills/<skill-name>/          # canonical 真实文件存放位置
│   │   └── SKILL.md
│   └── .skill-lock.json              # 全局锁文件
├── .claude/skills/<skill-name>/      # agent 目录（symlink → ../../.agents/skills/<skill-name>）
├── .cursor/skills/<skill-name>/
└── ...

<project>/                            # process.cwd()
├── .agents/
│   └── skills/<skill-name>/          # 项目级 canonical
├── .claude/skills/<skill-name>/      # 项目级 agent symlink
└── ...
```

## 9. 完整示例

```typescript
import { join, normalize, resolve, sep, relative, dirname, basename } from 'path';
import { homedir, platform, tmpdir } from 'os';
import { mkdir, symlink, cp, rm, lstat, readlink } from 'fs/promises';

const AGENTS_DIR = '.agents';
const SKILLS_SUBDIR = 'skills';

function sanitizeName(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9._]+/g, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '')
    .substring(0, 255) || 'unnamed';
}

function isPathSafe(basePath: string, targetPath: string): boolean {
  const normalizedBase = normalize(resolve(basePath));
  const normalizedTarget = normalize(resolve(targetPath));
  return normalizedTarget.startsWith(normalizedBase + sep) || 
         normalizedTarget === normalizedBase;
}

function getCanonicalSkillsDir(global: boolean, cwd?: string): string {
  const baseDir = global ? homedir() : cwd || process.cwd();
  return join(baseDir, AGENTS_DIR, SKILLS_SUBDIR);
}

async function createSymlink(target: string, linkPath: string): Promise<boolean> {
  try {
    // 确保父目录存在
    await mkdir(dirname(linkPath), { recursive: true });
    
    // 计算相对路径
    const relativePath = relative(dirname(linkPath), target);
    
    // 跨平台 symlink 类型
    const symlinkType = platform() === 'win32' ? 'junction' : undefined;
    
    await symlink(relativePath, linkPath, symlinkType);
    return true;
  } catch {
    return false;
  }
}

async function installSkill(
  skillName: string,
  sourcePath: string,
  options: { global?: boolean; cwd?: string } = {}
): Promise<{ success: boolean; path: string }> {
  const isGlobal = options.global ?? false;
  const cwd = options.cwd || process.cwd();
  
  // 清洗技能名称
  const safeName = sanitizeName(skillName);
  
  // 计算目标路径
  const canonicalBase = getCanonicalSkillsDir(isGlobal, cwd);
  const canonicalDir = join(canonicalBase, safeName);
  
  // 安全校验
  if (!isPathSafe(canonicalBase, canonicalDir)) {
    return { success: false, path: canonicalDir };
  }
  
  // 创建目录并复制文件
  await mkdir(canonicalDir, { recursive: true });
  await cp(sourcePath, canonicalDir, { recursive: true });
  
  return { success: true, path: canonicalDir };
}
```

## 10. 要点清单

- [ ] 使用 `path.join()` 拼接路径，不要硬编码分隔符
- [ ] 使用 `path.sep` 进行路径边界判断
- [ ] 使用 `os.homedir()` 获取用户主目录
- [ ] 使用 `os.platform()` 判断平台，仅在必要时（如 symlink 类型）
- [ ] 所有用户输入的路径必须通过 `isPathSafe()` 校验
- [ ] 所有用户输入的名称必须通过 `sanitizeName()` 清洗
- [ ] Windows symlink 使用 `junction` 类型
- [ ] symlink 失败时回退为复制
- [ ] 支持环境变量覆盖默认路径
