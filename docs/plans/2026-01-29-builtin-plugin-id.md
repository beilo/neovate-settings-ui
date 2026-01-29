# 内置插件 ID 标识方案

**Goal:** 将内置插件配置从绝对路径改为 `builtin:<id>` 格式，解决跨机器路径失效问题。

**Architecture:** 内置插件使用 `builtin:notify` 格式存储，运行时由 Neovate 解析为实际路径。自定义插件保持用户选择的绝对路径不变。前端启用内置插件时写入 ID 而非路径，显示时识别 `builtin:` 前缀做特殊展示。

**Tech Stack:** Rust (Tauri 后端), TypeScript/React (前端)

**参考规范:** `path-handling-standard.md` - 跨平台路径处理最佳实践

---

## 改动概览

| 层级 | 文件 | 改动说明 |
|------|------|----------|
| 后端 | `src-tauri/src/config.rs` | `install_builtin_plugin` 返回 `builtin:notify` |
| 前端 | `src/App.tsx` | 识别 `builtin:` 前缀，启用时写入 ID |
| 前端 | `src/lib/pathUtils.ts` | 新增跨平台路径工具函数（遵循规范） |

---

## Task 1: 修改后端 `install_builtin_plugin` 返回值

**Files:**
- Modify: `src-tauri/src/config.rs:43-47` (InstallBuiltinPluginResponse 结构体)
- Modify: `src-tauri/src/config.rs:175-195` (install_builtin_plugin 函数)

**Step 1: 修改 InstallBuiltinPluginResponse 结构体**

将 `path` 字段改为 `entry`，存储 `builtin:<id>` 格式：

```rust
#[derive(Serialize)]
pub struct InstallBuiltinPluginResponse {
  pub id: String,
  pub entry: String,  // 改名：存储 "builtin:notify" 格式
  pub path: String,   // 保留：实际文件路径，用于 UI 显示
  pub wrote: bool,
}
```

**Step 2: 修改 install_builtin_plugin 函数返回值**

```rust
#[tauri::command]
pub fn install_builtin_plugin(id: String) -> Result<InstallBuiltinPluginResponse, String> {
  let id = id.trim();
  if id.is_empty() {
    return Err("内置插件 id 不能为空".to_string());
  }

  let dest = builtin_plugin_dest_path(id)?;
  let content = builtin_plugin_content(id)?;

  if let Some(parent) = dest.parent() {
    fs::create_dir_all(parent).map_err(|e| format!("创建插件目录失败：{e}"))?;
  } else {
    return Err("插件路径不合法（无法获取父目录）".to_string());
  }

  // 为什么：默认不覆盖用户已有文件，避免覆盖用户的自定义修改。
  if dest.exists() {
    return Ok(InstallBuiltinPluginResponse {
      id: id.to_string(),
      entry: format!("builtin:{id}"),  // 新增：返回 ID 格式
      path: dest.to_string_lossy().to_string(),
      wrote: false,
    });
  }

  fs::write(&dest, content).map_err(|e| format!("写入内置插件失败：{e}"))?;

  Ok(InstallBuiltinPluginResponse {
    id: id.to_string(),
    entry: format!("builtin:{id}"),  // 新增：返回 ID 格式
    path: dest.to_string_lossy().to_string(),
    wrote: true,
  })
}
```

**Step 3: 验证编译通过**

Run: `cd /Users/am/temp/neovate-settings-ui/src-tauri && cargo check`
Expected: 编译成功，无错误

---

## Task 2: 修改前端识别 `builtin:` 前缀

**Files:**
- Modify: `src/App.tsx:261-265` (isBuiltinNotifyPluginEntry 函数)
- Modify: `src/App.tsx:540-555` (enableBuiltinNotify 回调)

**Step 1: 修改 isBuiltinNotifyPluginEntry 函数**

同时识别旧格式（路径）和新格式（ID）：

```typescript
function isBuiltinNotifyPluginEntry(value: string): boolean {
  // 为什么：新格式用 builtin:notify，旧格式用路径匹配，兼容已有配置。
  if (value === 'builtin:notify') return true
  return /[\\\/]\.neovate[\\\/]plugins[\\\/]notify\.js$/.test(value)
}
```

**Step 2: 修改 enableBuiltinNotify 写入逻辑**

使用 `res.entry`（`builtin:notify`）而非 `res.path`：

```typescript
const enableBuiltinNotify = useCallback(async () => {
  setBuiltinNotifyBusy(true)
  try {
    const res = (await invoke('install_builtin_plugin', { id: 'notify' })) as InstallBuiltinPluginResponse
    setBaseConfig((prevBase) => {
      const prevPlugins = pickStringArray((prevBase as Record<string, unknown>).plugins)
      // 为什么：用 entry（builtin:notify）而非 path，跨机器可移植。
      const nextPlugins = prevPlugins.some(isBuiltinNotifyPluginEntry)
        ? prevPlugins
        : [...prevPlugins, res.entry]
      return { ...prevBase, plugins: nextPlugins }
    })
    messageApi.success(res.wrote ? '内置通知插件已写入并启用' : '内置通知插件已启用（文件已存在）')
  } catch (e) {
    messageApi.error(`启用内置通知插件失败：${String(e)}`)
  } finally {
    setBuiltinNotifyBusy(false)
  }
}, [messageApi])
```

**Step 3: 修改 InstallBuiltinPluginResponse 类型定义**

在 `src/App.tsx` 中添加 `entry` 字段（约 227 行附近）：

```typescript
type InstallBuiltinPluginResponse = {
  id: string
  entry: string  // 新增：builtin:notify 格式
  path: string
  wrote: boolean
}
```

**Step 4: 修改 UI 显示逻辑**

在 plugins 卡片中，显示 `builtin:notify` 而非绝对路径（约 1460 行）：

```typescript
{builtinNotifyEntry && (
  <div style={{ marginTop: 6 }}>
    <Text type="secondary" style={{ fontSize: 11 }}>
      配置值：{builtinNotifyEntry}
    </Text>
  </div>
)}
```

**Step 5: 验证前端编译通过**

Run: `cd /Users/am/temp/neovate-settings-ui && npm run build`
Expected: 编译成功，无 TypeScript 错误

---

## Task 3: 端到端测试

**Step 1: 启动开发服务器**

Run: `cd /Users/am/temp/neovate-settings-ui && npm run tauri dev`
Expected: 应用正常启动

**Step 2: 测试启用内置插件**

1. 找到 `plugins` 设置项
2. 打开 `notify` 开关
3. 查看右侧 JSON 预览

Expected: 
```json
{
  "plugins": ["builtin:notify"]
}
```

**Step 3: 测试保存并重新加载**

1. 点击 Save 保存配置
2. 点击 Reload 重新加载

Expected: 开关保持开启状态，配置值仍为 `builtin:notify`

**Step 4: 测试向后兼容**

手动编辑 `~/.neovate/config.json`，写入旧格式：

```json
{
  "plugins": ["/Users/am/.neovate/plugins/notify.js"]
}
```

重新加载应用。

Expected: 开关显示为开启状态（识别旧格式）

---

## Task 4: 清理旧配置（可选）

**说明:** 如果用户之前已启用过内置插件，配置中可能存在绝对路径。可以添加迁移逻辑，将旧格式自动转为新格式。

**Files:**
- Modify: `src/App.tsx` (syncFromContent 函数)

**Step 1: 添加迁移逻辑**

在 `syncFromContent` 中，检测旧格式并自动转换：

```typescript
const syncFromContent = useCallback((content: string) => {
  const parsed = safeJsonParse(content)
  const base = parsed.ok && isPlainObject(parsed.value) ? parsed.value : {}
  
  // 为什么：迁移旧格式路径到新格式 ID，保持配置整洁。
  const rawPlugins = pickStringArray(base.plugins)
  const migratedPlugins = rawPlugins.map((p) => {
    if (p !== 'builtin:notify' && isBuiltinNotifyPluginEntry(p)) {
      return 'builtin:notify'
    }
    return p
  })
  if (JSON.stringify(rawPlugins) !== JSON.stringify(migratedPlugins)) {
    base.plugins = migratedPlugins
  }
  
  // ... 其余逻辑不变
}, [])
```

**注意:** 此迁移仅在内存中进行，用户需手动点击 Save 才会持久化。

---

## 完成检查清单

- [ ] Task 1: 后端 `install_builtin_plugin` 返回 `entry: "builtin:notify"`
- [ ] Task 2: 前端识别 `builtin:` 前缀，启用时写入 ID
- [ ] Task 3: 端到端测试通过
- [ ] Task 4: (可选) 旧格式迁移逻辑
