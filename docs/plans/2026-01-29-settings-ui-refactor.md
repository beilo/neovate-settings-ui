# Settings UI Refactor Implementation Plan

**Goal:** 拆分 `App.tsx` 与 `src-tauri/src/config.rs`，提升可维护性与可读性，保持现有行为不变。

**Architecture:** 前端将“配置模型/工具函数/界面组件/交互逻辑”分层，核心状态收敛到 `useConfigState`，复杂设置区拆成组件；后端将路径/内置插件/技能迁移拆成子模块，命令入口仍保持原名。

**Tech Stack:** React + Ant Design + Tauri (Rust)

---

### Task 1: 抽离前端类型与纯函数

**Files:**
- Create: `src/lib/configTypes.ts`
- Create: `src/lib/settingsSchema.ts`
- Create: `src/lib/configHelpers.ts`
- Modify: `src/App.tsx`

**Step 1: 新增类型文件（仅类型 + 说明注释）**
```ts
// src/lib/configTypes.ts
// 为什么：集中管理类型，减少 App.tsx 噪音。
export type SettingKind = 'enum' | 'boolean' | 'string' | 'number' | 'complex'
export type SettingDef = { key: string; kind: SettingKind; title: string; description: string; defaultHint: string; options?: string[] }
export type FormValue = string | number | boolean | undefined
export type FormState = Record<string, FormValue>
export type AgentConfig = { model?: string }
export type AgentDraft = Record<string, AgentConfig>
export type CommitConfig = { language?: string; systemPrompt?: string; model?: string }
export type NotificationMode = 'off' | 'defaultSound' | 'sound' | 'webhook'
export type NotificationDraft = { mode: NotificationMode; soundName: string; webhookUrl: string }
export type DesktopTheme = 'light' | 'dark' | 'system'
export type DesktopSendMessageWith = 'enter' | 'cmdEnter'
export type DesktopDraft = { theme?: DesktopTheme; sendMessageWith?: DesktopSendMessageWith; terminalFont?: string; terminalFontSize?: number }
export type ReadConfigResponse = { path: string; exists: boolean; content: string }
export type SkillsMigrationItem = { name: string; source: string; target: string; exists: boolean; isDir: boolean }
export type SkillsMigrationPlan = { items: SkillsMigrationItem[]; conflictCount: number }
export type SkillsMigrationResult = { copied: number; skipped: number; replaced: number }
export type InstallBuiltinPluginResponse = { id: string; entry: string; path: string; wrote: boolean }
```

**Step 2: 把 SETTINGS/常量迁出**
```ts
// src/lib/settingsSchema.ts
// 为什么：配置字段清单集中，便于维护与检索。
import type { SettingDef } from './configTypes'

export const SETTINGS: SettingDef[] = [ /* 现有数组原样迁移 */ ]
export const BUILTIN_AGENT_TYPES = ['Explore', 'GeneralPurpose'] as const
export const MACOS_SOUNDS = [ /* 现有数组原样迁移 */ ] as const
```

**Step 3: 抽离纯函数**
```ts
// src/lib/configHelpers.ts
// 为什么：纯函数收敛，便于测试与复用。
import { SETTINGS } from './settingsSchema'
import type { AgentDraft, CommitConfig, DesktopDraft, FormState, NotificationDraft } from './configTypes'

export function safeJsonParse(...) { ... }
export function isPlainObject(...) { ... }
export function stringifyConfig(...) { ... }
export function pickFormValues(...) { ... }
export function applyFormValues(...) { ... }
export function formatComplexValue(...) { ... }
export function pickStringArray(...) { ... }
export function isBuiltinNotifyPluginEntry(...) { ... }
export function pickAgentDraft(...) { ... }
export function normalizeAgentConfig(...) { ... }
export function pickCommitConfig(...) { ... }
export function normalizeCommitConfig(...) { ... }
export function pickNotificationDraft(...) { ... }
export function normalizeNotificationValue(...) { ... }
export function pickDesktopDraft(...) { ... }
export function normalizeDesktopConfig(...) { ... }
export function inferHomeFromConfigPath(...) { ... }
```

**Step 4: App.tsx 替换为导入**
- 移除原内联类型/常量/函数
- 改为从 `src/lib/*` 导入

### Task 2: 增加 hooks 并拆 UI 组件

**Files:**
- Create: `src/hooks/useConfigState.ts`
- Create: `src/hooks/useResizablePanel.ts`
- Create: `src/components/AppHeader.tsx`
- Create: `src/components/SettingsPanel.tsx`
- Create: `src/components/JsonPreviewPanel.tsx`
- Create: `src/components/McpServersModal.tsx`
- Create: `src/components/SkillsConflictModal.tsx`
- Modify: `src/App.tsx`

**Step 1: 新增 useConfigState**
```ts
// 为什么：集中管理配置状态与动作，降低 App 复杂度。
export function useConfigState() {
  // 维持原有 state + handlers（逻辑不变，仅搬迁）
  return { state, actions, contextHolder }
}
```

**Step 2: 新增 useResizablePanel**
```ts
// 为什么：拖拽分割线逻辑独立，避免 App.tsx 膨胀。
export function useResizablePanel(initialWidth: number) {
  return { width, onMouseDown }
}
```

**Step 3: 把 UI 块拆为组件**
- `AppHeader`：顶部品牌+加载/保存按钮
- `SettingsPanel`：搜索 + 设置列表（含复杂设置区）
- `JsonPreviewPanel`：只负责 CodeMirror 只读预览
- `McpServersModal`、`SkillsConflictModal`：弹窗独立

**Step 4: App.tsx 变薄**
- 只负责布局、组装 hooks 与组件

### Task 3: 拆分 src-tauri config 模块

**Files:**
- Create: `src-tauri/src/config/mod.rs`
- Create: `src-tauri/src/config/paths.rs`
- Create: `src-tauri/src/config/plugins.rs`
- Create: `src-tauri/src/config/skills.rs`
- Modify: `src-tauri/src/lib.rs`
- Remove: `src-tauri/src/config.rs`

**Step 1: 拆出 paths.rs**
```rust
// 为什么：路径与 home 逻辑独立，便于复用。
pub fn home_dir() -> Result<PathBuf, String> { ... }
pub fn expand_tilde(path: &str) -> Result<PathBuf, String> { ... }
pub fn config_path() -> Result<PathBuf, String> { ... }
```

**Step 2: 拆出 plugins.rs**
```rust
// 为什么：内置插件逻辑单独维护，避免 config.rs 过长。
const BUILTIN_NOTIFY_PLUGIN_JS: &str = include_str!("../builtin-plugins/notify.js");
pub fn builtin_plugin_dest_path(id: &str) -> Result<PathBuf, String> { ... }
pub fn builtin_plugin_content(id: &str) -> Result<&'static str, String> { ... }
```

**Step 3: 拆出 skills.rs**
```rust
// 为什么：技能迁移流程封装，命令入口更清晰。
pub fn build_skills_plan(...) -> Result<Vec<SkillsMigrationItem>, String> { ... }
pub fn apply_skills_migration_core(...) -> Result<SkillsMigrationResult, String> { ... }
```

**Step 4: mod.rs 统一入口**
- 定义结构体与 `#[tauri::command]`，内部调用子模块
- `lib.rs` 中 `mod config;` 保持不变（指向目录）

### Task 4: 自测与验证

**Files:**
- Modify: `README.md`（如需补充简单说明）

**Step 1: 运行前端**
Run: `npm run dev`
Expected: 页面正常加载、保存/加载不报错、右侧 JSON 预览与 UI 同步

**Step 2: Tauri 侧自测**
Run: `npm run tauri dev`
Expected: 配置读写、技能迁移、内置插件启用正常

---

未解决问题：无
