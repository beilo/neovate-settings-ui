import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { invoke } from '@tauri-apps/api/core'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import {
  Layout,
  Button,
  Input,
  Select,
  Typography,
  Tag,
  Modal,
  message,
  ConfigProvider,
  Switch,
  Card,
  Popconfirm,
} from 'antd'
import {
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  RobotOutlined,
} from '@ant-design/icons'
import './App.css'

const { Header, Content } = Layout
const { Title, Text } = Typography
const { Option } = Select

type SettingKind = 'enum' | 'boolean' | 'string' | 'number' | 'complex'

type SettingDef = {
  key: string
  kind: SettingKind
  title: string
  description: string
  defaultHint: string
  options?: string[]
}

type FormValue = string | number | boolean | undefined

type FormState = Record<string, FormValue>

// 为什么：左侧标题需要与配置键完全一致，便于用户按官网字段检索。
const SETTINGS: SettingDef[] = [
  {
    key: 'approvalMode',
    kind: 'enum',
    title: 'approvalMode',
    description: '审批模式',
    defaultHint: '"default"',
    options: ['autoEdit', 'yolo', 'default'],
  },
  // 为什么：补齐 agent/skills，确保设置清单与官方字段一一对应。
  {
    key: 'agent',
    kind: 'complex',
    title: 'agent',
    description:
      '为不同的代理类型配置特定设置。每个代理类型可以有自己的模型和其他配置。\n模型解析优先级：显式模型参数 > agent.{type}.model > 代理定义中的模型 > 全局 model。\n可用类型：Explore、GeneralPurpose。',
    defaultHint: '{}',
  },
  {
    key: 'autoCompact',
    kind: 'boolean',
    title: 'autoCompact',
    description: '自动压缩历史消息',
    defaultHint: 'true',
  },
  {
    key: 'autoUpdate',
    kind: 'boolean',
    title: 'autoUpdate',
    description: '自动更新',
    defaultHint: 'true',
  },
  {
    key: 'browser',
    kind: 'boolean',
    title: 'browser',
    description: '浏览器 MCP 集成',
    defaultHint: 'false',
  },
  {
    key: 'commit',
    kind: 'complex',
    title: 'commit',
    description: '提交信息生成配置（language/systemPrompt/model）',
    defaultHint: '{ language: "en", systemPrompt?: string, model?: "provider_id/model_id" }',
  },
  {
    key: 'desktop',
    kind: 'complex',
    title: 'desktop',
    description: '桌面应用配置。此设置只能全局设置。',
    defaultHint: '{ theme: "light", sendMessageWith: "enter" }',
  },
  {
    key: 'extensions',
    kind: 'complex',
    title: 'extensions',
    description: '第三方 Agent 扩展',
    defaultHint: '{}',
  },
  {
    key: 'httpProxy',
    kind: 'string',
    title: 'httpProxy',
    description: '网络代理地址',
    defaultHint: 'null',
  },
  {
    key: 'language',
    kind: 'string',
    title: 'language',
    description: '界面与回复语言',
    defaultHint: '"English"',
  },
  {
    key: 'mcpServers',
    kind: 'complex',
    title: 'mcpServers',
    description: 'MCP 服务器配置',
    defaultHint: '{}',
  },
  {
    key: 'model',
    kind: 'string',
    title: 'model',
    description: '默认模型',
    defaultHint: 'null',
  },
  {
    key: 'notification',
    kind: 'complex',
    title: 'notification',
    description: '指定会话完成时的通知行为。',
    defaultHint: 'false',
  },
  {
    key: 'outputFormat',
    kind: 'enum',
    title: 'outputFormat',
    description: 'CLI 输出格式',
    defaultHint: '"text"',
    options: ['text', 'stream-json', 'json'],
  },
  {
    key: 'outputStyle',
    kind: 'string',
    title: 'outputStyle',
    description: '输出风格',
    defaultHint: '"Default"',
  },
  {
    key: 'planModel',
    kind: 'string',
    title: 'planModel',
    description: '规划模型',
    defaultHint: '同 model',
  },
  {
    key: 'plugins',
    kind: 'complex',
    title: 'plugins',
    description: '启用的插件列表',
    defaultHint: '[]',
  },
  {
    key: 'provider',
    kind: 'complex',
    title: 'provider',
    description: '自定义 Provider 配置',
    defaultHint: '{}',
  },
  {
    key: 'quiet',
    kind: 'boolean',
    title: 'quiet',
    description: '静默模式',
    defaultHint: 'false',
  },
  {
    key: 'skills',
    kind: 'complex',
    title: 'skills',
    description: '指定要加载的额外 SKILL.md 文件或目录（每个条目为文件路径或包含该文件的目录）。',
    defaultHint: '[]',
  },
  {
    key: 'smallModel',
    kind: 'string',
    title: 'smallModel',
    description: '轻量任务模型',
    defaultHint: '同 model',
  },
  {
    key: 'systemPrompt',
    kind: 'string',
    title: 'systemPrompt',
    description: '系统提示词',
    defaultHint: 'null',
  },
  {
    key: 'temperature',
    kind: 'number',
    title: 'temperature',
    description: '模型随机性 (0-1)',
    defaultHint: 'null',
  },
  {
    key: 'todo',
    kind: 'boolean',
    title: 'todo',
    description: '启用 Todo 功能',
    defaultHint: 'true',
  },
  {
    key: 'tools',
    kind: 'complex',
    title: 'tools',
    description: '工具开关配置',
    defaultHint: '{}',
  },
  {
    key: 'visionModel',
    kind: 'string',
    title: 'visionModel',
    description: '视觉模型',
    defaultHint: '同 model',
  },
]

type ReadConfigResponse = {
  path: string
  exists: boolean
  content: string
}

// 为什么：AgentConfig 只需要 model 字段，未来可扩展其他配置
type AgentConfig = {
  model?: string
}

// 为什么：AgentDraft 是 UI 编辑状态，key 是 agent 类型名，value 是配置
type AgentDraft = Record<string, AgentConfig>

// 为什么：系统内置的 Agent 类型，这些不允许删除 key，只允许修改配置
const BUILTIN_AGENT_TYPES = ['Explore', 'GeneralPurpose'] as const

// 为什么：常用模型预设，提供下拉选项；用户也可自由输入（当前版本暂未使用，保留供后续扩展）
const _COMMON_MODELS = [
  // Anthropic
  { value: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (最新)' },
  { value: 'anthropic/claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'anthropic/claude-haiku-4-20250514', label: 'Claude Haiku 4 (快速)' },
  { value: 'anthropic/claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'anthropic/claude-3-opus-20240229', label: 'Claude 3 Opus' },
  // OpenAI
  { value: 'openai/gpt-4o', label: 'GPT-4o' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (快速)' },
  { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'openai/o1', label: 'o1 (推理)' },
  { value: 'openai/o1-mini', label: 'o1-mini' },
  // Google
  { value: 'google/gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'google/gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  // Groq (快速推理)
  { value: 'groq/llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' },
  { value: 'groq/llama-3.1-8b-instant', label: 'Llama 3.1 8B (Groq 极速)' },
] as const
void _COMMON_MODELS // 为什么：显式标记为已使用，避免 TS6133 警告

type CommitConfig = {
  language?: string
  systemPrompt?: string
  model?: string
}

type NotificationMode = 'off' | 'defaultSound' | 'sound' | 'webhook'

type NotificationDraft = {
  mode: NotificationMode
  soundName: string
  webhookUrl: string
}

type DesktopTheme = 'light' | 'dark' | 'system'

type DesktopSendMessageWith = 'enter' | 'cmdEnter'

type DesktopDraft = {
  theme?: DesktopTheme
  sendMessageWith?: DesktopSendMessageWith
  terminalFont?: string
  terminalFontSize?: number
}

type SkillsMigrationItem = {
  name: string
  source: string
  target: string
  exists: boolean
  isDir: boolean
}

type SkillsMigrationPlan = {
  items: SkillsMigrationItem[]
  conflictCount: number
}

type SkillsMigrationResult = {
  copied: number
  skipped: number
  replaced: number
}

type InstallBuiltinPluginResponse = {
  id: string
  path: string
  wrote: boolean
}

const MACOS_SOUNDS = [
  'Basso',
  'Blow',
  'Bottle',
  'Frog',
  'Funk',
  'Glass',
  'Hero',
  'Morse',
  'Ping',
  'Pop',
  'Purr',
  'Sosumi',
  'Submarine',
  'Tink',
] as const

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringifyConfig(config: Record<string, unknown>): string {
  return `${JSON.stringify(config, null, 2)}\n`
}

function pickFormValues(config: Record<string, unknown>): FormState {
  const next: FormState = {}
  for (const def of SETTINGS) {
    if (def.kind === 'complex') continue
    const raw = config[def.key]
    if (def.kind === 'boolean' && typeof raw === 'boolean') next[def.key] = raw
    if (def.kind === 'number' && typeof raw === 'number') next[def.key] = raw
    if (def.kind === 'string' && typeof raw === 'string') next[def.key] = raw
    if (def.kind === 'enum' && typeof raw === 'string' && def.options?.includes(raw)) next[def.key] = raw
  }
  return next
}

function applyFormValues(base: Record<string, unknown>, form: FormState): Record<string, unknown> {
  const next = { ...base }
  for (const def of SETTINGS) {
    if (def.kind === 'complex') continue
    const value = form[def.key]
    if (value === undefined || value === '') {
      delete next[def.key]
      continue
    }
    next[def.key] = value
  }
  return next
}

function formatComplexValue(value: unknown): string {
  if (value === undefined) return '未设置'
  try {
    const raw = JSON.stringify(value)
    return raw.length > 60 ? `${raw.slice(0, 60)}…` : raw
  } catch {
    return '（无法展示）'
  }
}

function pickStringArray(value: unknown): string[] {
  // 为什么：plugins 等字段是数组，但用户可能手改成其他类型；这里兜底为字符串数组。
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function isBuiltinNotifyPluginEntry(value: string): boolean {
  // 为什么：兼容不同平台路径分隔符；只要以 .neovate/plugins/notify.js 结尾就视为同一个插件。
  return /[\\/]\.neovate[\\/]plugins[\\/]notify\.js$/.test(value)
}

// 为什么：从配置中提取 agent 字段，转换为 UI 可编辑的 AgentDraft
function pickAgentDraft(value: unknown): AgentDraft {
  if (!isPlainObject(value)) return {}
  const draft: AgentDraft = {}
  for (const [key, config] of Object.entries(value)) {
    if (isPlainObject(config)) {
      draft[key] = {
        model: typeof config.model === 'string' ? config.model : undefined,
      }
    }
  }
  return draft
}

// 为什么：将 AgentDraft 归一化为配置格式，空对象不写入
function normalizeAgentConfig(draft: AgentDraft): AgentDraft | undefined {
  const next: AgentDraft = {}
  for (const [key, config] of Object.entries(draft)) {
    const model = config.model?.trim()
    if (model) {
      next[key] = { model }
    }
  }
  return Object.keys(next).length === 0 ? undefined : next
}

function pickCommitConfig(value: unknown): CommitConfig | undefined {
  if (!isPlainObject(value)) return undefined
  const next: CommitConfig = {}
  if (typeof value.language === 'string') next.language = value.language
  if (typeof value.systemPrompt === 'string') next.systemPrompt = value.systemPrompt
  if (typeof value.model === 'string') next.model = value.model
  return Object.keys(next).length === 0 ? undefined : next
}

function normalizeCommitConfig(draft: CommitConfig): CommitConfig | undefined {
  const next: CommitConfig = {}
  const language = draft.language?.trim()
  const systemPrompt = draft.systemPrompt?.trim()
  const model = draft.model?.trim()

  if (language) next.language = language
  if (systemPrompt) next.systemPrompt = systemPrompt
  if (model) next.model = model

  // 为什么：只写默认值会制造配置噪音；删除字段等价于走默认逻辑。
  if (Object.keys(next).length === 0) return undefined
  if (next.language === 'en' && next.systemPrompt === undefined && next.model === undefined) return undefined

  return next
}

function pickNotificationDraft(value: unknown): NotificationDraft {
  if (value === true) return { mode: 'defaultSound', soundName: '', webhookUrl: '' }
  if (value === false || value === undefined) return { mode: 'off', soundName: '', webhookUrl: '' }
  if (typeof value !== 'string') return { mode: 'off', soundName: '', webhookUrl: '' }

  const trimmed = value.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { mode: 'webhook', soundName: '', webhookUrl: trimmed }
  }
  return { mode: 'sound', soundName: trimmed, webhookUrl: '' }
}

function normalizeNotificationValue(draft: NotificationDraft): boolean | string | undefined {
  if (draft.mode === 'off') return undefined
  if (draft.mode === 'defaultSound') return true
  if (draft.mode === 'sound') {
    const sound = draft.soundName.trim()
    return sound ? sound : undefined
  }
  const url = draft.webhookUrl.trim()
  return url ? url : undefined
}

function pickDesktopDraft(value: unknown): DesktopDraft {
  if (!isPlainObject(value)) return {}
  const draft: DesktopDraft = {}
  if (value.theme === 'light' || value.theme === 'dark' || value.theme === 'system') draft.theme = value.theme
  if (value.sendMessageWith === 'enter' || value.sendMessageWith === 'cmdEnter') draft.sendMessageWith = value.sendMessageWith
  if (typeof value.terminalFont === 'string') draft.terminalFont = value.terminalFont
  if (typeof value.terminalFontSize === 'number' && Number.isFinite(value.terminalFontSize)) {
    draft.terminalFontSize = value.terminalFontSize
  }
  return draft
}

function normalizeDesktopConfig(draft: DesktopDraft): DesktopDraft | undefined {
  const next: DesktopDraft = {}
  const font = draft.terminalFont?.trim()

  if (draft.theme && draft.theme !== 'light') next.theme = draft.theme
  if (draft.sendMessageWith && draft.sendMessageWith !== 'enter') next.sendMessageWith = draft.sendMessageWith
  if (font) next.terminalFont = font
  if (typeof draft.terminalFontSize === 'number' && Number.isFinite(draft.terminalFontSize)) {
    next.terminalFontSize = draft.terminalFontSize
  }

  // 为什么：默认值不写入配置，避免全局配置文件产生噪音。
  return Object.keys(next).length === 0 ? undefined : next
}

function inferHomeFromConfigPath(path: string): string | null {
  if (!path) return null
  if (path.endsWith('/.neovate/config.json')) return path.slice(0, -'/.neovate/config.json'.length)
  if (path.endsWith('\\.neovate\\config.json')) return path.slice(0, -'\\.neovate\\config.json'.length)
  return null
}

export default function App() {
  const [configPath, setConfigPath] = useState<string>('')
  const [exists, setExists] = useState<boolean>(true)
  const [sourceText, setSourceText] = useState<string>(`{
}
`)
  const [baseConfig, setBaseConfig] = useState<Record<string, unknown>>({})
  const [formValues, setFormValues] = useState<FormState>({})
  const [searchText, setSearchText] = useState<string>('')
  const loadedTextRef = useRef<string>('{\n}\n')

  const [busy, setBusy] = useState<boolean>(false)
  const [messageApi, contextHolder] = message.useMessage()

  const [commitDraft, setCommitDraft] = useState<CommitConfig>({})
  const [notificationDraft, setNotificationDraft] = useState<NotificationDraft>({
    mode: 'off',
    soundName: '',
    webhookUrl: '',
  })
  const [desktopDraft, setDesktopDraft] = useState<DesktopDraft>({})
  const [agentDraft, setAgentDraft] = useState<AgentDraft>({})
  // 为什么：mcpServers 用 JSON 字符串草稿，支持粘贴后格式化
  const [mcpServersDraft, setMcpServersDraft] = useState<string>('')
  const [mcpServersError, setMcpServersError] = useState<string>('')
  const [mcpServersModalOpen, setMcpServersModalOpen] = useState<boolean>(false)
  const [skillsSourcePath, setSkillsSourcePath] = useState<string>('')
  const [skillsTargetPath, setSkillsTargetPath] = useState<string>('')
  const [skillsBusy, setSkillsBusy] = useState<boolean>(false)
  const [skillsPlan, setSkillsPlan] = useState<SkillsMigrationPlan | null>(null)
  const [skillsModalOpen, setSkillsModalOpen] = useState<boolean>(false)

  // 为什么：内置插件安装过程需要异步写文件，避免重复点击造成并发写入。
  const [builtinNotifyBusy, setBuiltinNotifyBusy] = useState<boolean>(false)

  // 为什么：右侧 JSON 预览面板宽度，支持拖拽调整
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(400)
  const isDraggingRef = useRef<boolean>(false)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(400)

  const parse = useMemo(() => safeJsonParse(sourceText), [sourceText])
  const isValid = parse.ok
  const previewConfig = useMemo(() => applyFormValues(baseConfig, formValues), [baseConfig, formValues])
  const previewText = useMemo(() => stringifyConfig(previewConfig), [previewConfig])
  const dirty = previewText !== loadedTextRef.current
  const builtinNotifyEntry = useMemo(() => {
    const plugins = pickStringArray((previewConfig as Record<string, unknown>).plugins)
    return plugins.find(isBuiltinNotifyPluginEntry)
  }, [previewConfig])
  const builtinNotifyEnabled = !!builtinNotifyEntry
  const filteredSettings = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    if (!keyword) return SETTINGS
    return SETTINGS.filter((def) => {
      const options = def.options ? def.options.join(' ') : ''
      const haystack = `${def.key} ${def.title} ${def.description} ${def.defaultHint} ${options}`.toLowerCase()
      return haystack.includes(keyword)
    })
  }, [searchText])

  const syncFromContent = useCallback((content: string) => {
    const parsed = safeJsonParse(content)
    const base = parsed.ok && isPlainObject(parsed.value) ? parsed.value : {}
    const picked = pickFormValues(base)
    const commit = pickCommitConfig(base.commit)
    setSourceText(content)
    setBaseConfig(base)
    setFormValues(picked)
    // 为什么：commit 是嵌套对象，不走扁平表单；这里用单独的 draft 状态承接 UI 编辑。
    setCommitDraft({
      language: commit?.language ?? '',
      systemPrompt: commit?.systemPrompt ?? '',
      model: commit?.model ?? '',
    })
    // 为什么：notification 是 boolean|string 联合类型；用模式 + 值的最小编辑器避免歧义。
    setNotificationDraft(pickNotificationDraft(base.notification))
    // 为什么：desktop 是嵌套对象，需要独立草稿才能做字段级内联编辑。
    setDesktopDraft(pickDesktopDraft(base.desktop))
    // 为什么：agent 是 Record<string, AgentConfig>，需要单独草稿支持卡片编辑
    setAgentDraft(pickAgentDraft(base.agent))
    // 为什么：mcpServers 用 JSON 字符串存储，方便粘贴和格式化
    const mcpValue = base.mcpServers
    if (mcpValue !== undefined && isPlainObject(mcpValue) && Object.keys(mcpValue).length > 0) {
      setMcpServersDraft(JSON.stringify(mcpValue, null, 2))
      setMcpServersError('')
    } else {
      setMcpServersDraft('')
      setMcpServersError('')
    }
    loadedTextRef.current = stringifyConfig(applyFormValues(base, picked))
  }, [])

  const reload = useCallback(async () => {
    setBusy(true)
    try {
      const res = (await invoke('read_config')) as ReadConfigResponse
      setConfigPath(res.path)
      setExists(res.exists)
      syncFromContent(res.content)
      messageApi.success('配置已加载')
    } catch (e) {
      messageApi.error(`加载失败：${String(e)}`)
    } finally {
      setBusy(false)
    }
  }, [syncFromContent, messageApi])

  async function save() {
    setBusy(true)
    try {
      await invoke('write_config', { content: previewText })
      syncFromContent(previewText)
      setExists(true)
      messageApi.success('配置已保存')
    } catch (e) {
      messageApi.error(`保存失败：${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  const enableBuiltinNotify = useCallback(async () => {
    setBuiltinNotifyBusy(true)
    try {
      const res = (await invoke('install_builtin_plugin', { id: 'notify' })) as InstallBuiltinPluginResponse
      setBaseConfig((prevBase) => {
        const prevPlugins = pickStringArray((prevBase as Record<string, unknown>).plugins)
        const nextPlugins = prevPlugins.includes(res.path) ? prevPlugins : [...prevPlugins, res.path]
        return { ...prevBase, plugins: nextPlugins }
      })
      messageApi.success(res.wrote ? '内置通知插件已写入并启用' : '内置通知插件已启用（文件已存在）')
    } catch (e) {
      messageApi.error(`启用内置通知插件失败：${String(e)}`)
    } finally {
      setBuiltinNotifyBusy(false)
    }
  }, [messageApi])

  const disableBuiltinNotify = useCallback(() => {
    setBaseConfig((prevBase) => {
      const prevPlugins = pickStringArray((prevBase as Record<string, unknown>).plugins)
      const nextPlugins = prevPlugins.filter((p) => !isBuiltinNotifyPluginEntry(p))
      const nextBase = { ...prevBase } as Record<string, unknown>
      if (nextPlugins.length === 0) delete nextBase.plugins
      else nextBase.plugins = nextPlugins
      return nextBase
    })
    messageApi.success('已禁用内置通知插件')
  }, [messageApi])

  const resetCommitDraft = useCallback(() => {
    // 为什么：恢复默认时不强行写入默认值；清空字段等价于走默认逻辑，避免配置噪音。
    const nextDraft: CommitConfig = { language: '', systemPrompt: '', model: '' }
    setCommitDraft(nextDraft)
    setBaseConfig((prev) => {
      const next = { ...prev }
      delete next.commit
      return next
    })
  }, [])

  const updateCommitDraft = useCallback((patch: Partial<CommitConfig>) => {
    // 为什么：内联编辑需要“所见即所得”；每次改动都同步到 baseConfig，让右侧 JSON 预览立即更新。
    setCommitDraft((prevDraft) => {
      const nextDraft: CommitConfig = { ...prevDraft, ...patch }
      const normalized = normalizeCommitConfig(nextDraft)
      setBaseConfig((prevBase) => {
        const nextBase = { ...prevBase }
        if (normalized) nextBase.commit = normalized
        else delete nextBase.commit
        return nextBase
      })
      return nextDraft
    })
  }, [])

  const resetNotificationDraft = useCallback(() => {
    // 为什么：默认值是 false；重置时直接删除字段，比写入 false 更干净。
    const nextDraft: NotificationDraft = { mode: 'off', soundName: '', webhookUrl: '' }
    setNotificationDraft(nextDraft)
    setBaseConfig((prev) => {
      const next = { ...prev }
      delete next.notification
      return next
    })
  }, [])

  const updateNotificationDraft = useCallback((patch: Partial<NotificationDraft>) => {
    // 为什么：notification 的最终值依赖 mode；必须统一归一化，避免写出无效组合。
    setNotificationDraft((prevDraft) => {
      const nextDraft: NotificationDraft = { ...prevDraft, ...patch }
      const normalized = normalizeNotificationValue(nextDraft)
      setBaseConfig((prevBase) => {
        const nextBase = { ...prevBase }
        if (normalized === undefined) delete nextBase.notification
        else nextBase.notification = normalized
        return nextBase
      })
      return nextDraft
    })
  }, [])

  const resetDesktopDraft = useCallback(() => {
    // 为什么：恢复默认时删除 desktop 字段，保持配置最小化。
    const nextDraft: DesktopDraft = {}
    setDesktopDraft(nextDraft)
    setBaseConfig((prev) => {
      const next = { ...prev }
      delete next.desktop
      return next
    })
  }, [])

  const updateDesktopDraft = useCallback((patch: Partial<DesktopDraft>) => {
    // 为什么：内联编辑必须即时反映到 JSON 预览，减少用户误解。
    setDesktopDraft((prevDraft) => {
      const nextDraft: DesktopDraft = { ...prevDraft, ...patch }
      const normalized = normalizeDesktopConfig(nextDraft)
      setBaseConfig((prevBase) => {
        const nextBase = { ...prevBase }
        if (normalized) nextBase.desktop = normalized
        else delete nextBase.desktop
        return nextBase
      })
      return nextDraft
    })
  }, [])

  // 为什么：更新单个 Agent 的 model，同步到 baseConfig
  const updateAgentModel = useCallback((agentType: string, model: string) => {
    setAgentDraft((prevDraft) => {
      const nextDraft = { ...prevDraft, [agentType]: { model } }
      const normalized = normalizeAgentConfig(nextDraft)
      setBaseConfig((prevBase) => {
        const nextBase = { ...prevBase }
        if (normalized) nextBase.agent = normalized
        else delete nextBase.agent
        return nextBase
      })
      return nextDraft
    })
  }, [])

  // 为什么：删除 Agent 配置（仅允许删除自定义 Agent）
  const removeAgent = useCallback((agentType: string) => {
    setAgentDraft((prevDraft) => {
      const nextDraft = { ...prevDraft }
      delete nextDraft[agentType]
      const normalized = normalizeAgentConfig(nextDraft)
      setBaseConfig((prevBase) => {
        const nextBase = { ...prevBase }
        if (normalized) nextBase.agent = normalized
        else delete nextBase.agent
        return nextBase
      })
      return nextDraft
    })
  }, [])

  // 为什么：重置所有 Agent 配置
  const resetAgentDraft = useCallback(() => {
    setAgentDraft({})
    setBaseConfig((prev) => {
      const next = { ...prev }
      delete next.agent
      return next
    })
  }, [])

  // 为什么：mcpServers 用 JSON 文本编辑，支持直接粘贴配置
  const updateMcpServersDraft = useCallback((text: string) => {
    setMcpServersDraft(text)
    if (text.trim() === '') {
      // 清空时删除 mcpServers 字段
      setMcpServersError('')
      setBaseConfig((prev) => {
        const next = { ...prev }
        delete next.mcpServers
        return next
      })
      return
    }
    const parsed = safeJsonParse(text)
    if (!parsed.ok) {
      setMcpServersError('JSON 格式错误')
      return
    }
    if (!isPlainObject(parsed.value)) {
      setMcpServersError('必须是对象类型 {}')
      return
    }
    setMcpServersError('')
    setBaseConfig((prev) => {
      const next = { ...prev }
      if (Object.keys(parsed.value as object).length === 0) {
        delete next.mcpServers
      } else {
        next.mcpServers = parsed.value
      }
      return next
    })
  }, [])

  // 为什么：格式化 JSON，让粘贴的内容更整洁
  const formatMcpServersDraft = useCallback(() => {
    const text = mcpServersDraft.trim()
    if (!text) return
    const parsed = safeJsonParse(text)
    if (parsed.ok && isPlainObject(parsed.value)) {
      setMcpServersDraft(JSON.stringify(parsed.value, null, 2))
      setMcpServersError('')
    }
  }, [mcpServersDraft])

  // 为什么：重置 mcpServers 配置
  const resetMcpServersDraft = useCallback(() => {
    setMcpServersDraft('')
    setMcpServersError('')
    setBaseConfig((prev) => {
      const next = { ...prev }
      delete next.mcpServers
      return next
    })
  }, [])

  const applySkillsMigration = useCallback(
    async (mode: 'replace' | 'skip') => {
      setSkillsBusy(true)
      try {
        const result = (await invoke('apply_skills_migration', {
          sourcePath: skillsSourcePath,
          targetPath: skillsTargetPath,
          mode,
        })) as SkillsMigrationResult
        messageApi.success(`迁移完成：复制 ${result.copied}，替换 ${result.replaced}，跳过 ${result.skipped}`)
      } catch (e) {
        messageApi.error(`迁移失败：${String(e)}`)
      } finally {
        setSkillsBusy(false)
      }
    },
    [skillsSourcePath, skillsTargetPath, messageApi]
  )

  const runSkillsMigration = useCallback(async () => {
    const source = skillsSourcePath.trim()
    const target = skillsTargetPath.trim()
    if (!source || !target) {
      messageApi.warning('请先填写源目录和目标目录')
      return
    }
    setSkillsBusy(true)
    try {
      const plan = (await invoke('plan_skills_migration', {
        sourcePath: source,
        targetPath: target,
      })) as SkillsMigrationPlan
      if (plan.items.length === 0) {
        messageApi.info('未找到可迁移的技能目录或文件')
        return
      }
      if (plan.conflictCount > 0) {
        setSkillsPlan(plan)
        setSkillsModalOpen(true)
        return
      }
      await applySkillsMigration('replace')
    } catch (e) {
      messageApi.error(`迁移失败：${String(e)}`)
    } finally {
      setSkillsBusy(false)
    }
  }, [skillsSourcePath, skillsTargetPath, applySkillsMigration, messageApi])

  useEffect(() => {
    const storedSource = localStorage.getItem('neovate.skills.sourcePath')
    const storedTarget = localStorage.getItem('neovate.skills.targetPath')
    if (storedSource) setSkillsSourcePath(storedSource)
    if (storedTarget) setSkillsTargetPath(storedTarget)
  }, [])

  useEffect(() => {
    if (skillsSourcePath) localStorage.setItem('neovate.skills.sourcePath', skillsSourcePath)
  }, [skillsSourcePath])

  useEffect(() => {
    if (skillsTargetPath) localStorage.setItem('neovate.skills.targetPath', skillsTargetPath)
  }, [skillsTargetPath])

  useEffect(() => {
    if (skillsSourcePath || skillsTargetPath || !configPath) return
    const home = inferHomeFromConfigPath(configPath)
    if (!home) return
    // 为什么：给出常见默认值，用户仍可手动修改。
    setSkillsSourcePath(`${home}/.claude/skills`)
    setSkillsTargetPath(`${home}/.neovate/skills`)
  }, [configPath, skillsSourcePath, skillsTargetPath])

  useEffect(() => {
    void reload()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 为什么：拖拽分割线调整右侧面板宽度的事件处理
  const handleDividerMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = rightPanelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [rightPanelWidth])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      // 为什么：向左拖动增加宽度，向右拖动减少宽度
      const delta = startXRef.current - e.clientX
      const newWidth = Math.max(200, Math.min(800, startWidthRef.current + delta))
      setRightPanelWidth(newWidth)
    }

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // 为什么：北欧极简风格的主题配置，使用 CSS 变量实现自适应
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2D7A8C', // 北欧蓝绿色调
          fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
          borderRadius: 6,
          colorBgContainer: 'var(--color-bg-elevated)',
          colorBgLayout: 'var(--color-bg-base)',
          colorText: 'var(--color-text-primary)',
          colorTextSecondary: 'var(--color-text-secondary)',
          controlHeight: 36,
        },
        components: {
          Button: {
            borderRadius: 6,
            controlHeight: 32,
            fontSize: 13,
            fontWeight: 500,
          },
          Input: {
            borderRadius: 6,
          },
          Select: {
            borderRadius: 6,
          },
          Switch: {
            colorPrimary: '#2D7A8C',
          }
        }
      }}
    >
      {contextHolder}
      <Layout className="app-layout">
        {/* 为什么：北欧极简风格的顶栏，毛玻璃效果 + 优雅留白 */}
        <Header className="app-header">
          <div className="app-header-brand">
            <div className="app-header-logo">N</div>
            <Title level={5} className="app-header-title" style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
              Settings
            </Title>
            {dirty && <div className="dirty-indicator" />}
          </div>

          <div className="app-header-actions">
            <div className="app-header-meta">
              <Text className="app-header-path">{configPath || 'config.json'}</Text>
              <div className="app-header-status">
                <div className={`status-dot ${exists ? '' : 'status-dot--new'}`} />
                <span>{exists ? 'Loaded' : 'New'}</span>
              </div>
            </div>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={reload} 
              loading={busy}
              className="nordic-btn nordic-btn--icon"
            />
            <Button 
              type="primary" 
              icon={<SaveOutlined />} 
              onClick={save} 
              disabled={busy || !dirty}
              className="nordic-btn nordic-btn--primary"
            >
              Save
            </Button>
          </div>
        </Header>

        <Content className="app-content">
          
          {/* 为什么：北欧风格的设置列表区，大量留白、优雅排版 */}
          <div className="settings-panel">
            
            {/* 为什么：浮动搜索栏 sticky 定位，滚动时始终可见 */}
            <div className="settings-search-wrapper">
              <div className="settings-container">
                <div className="settings-search">
                  <SearchOutlined className="settings-search-icon" />
                  <input
                    type="text"
                    className="settings-search-input"
                    placeholder="搜索设置项..."
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="settings-container">
              
              {!isValid && (
                 <div className="error-alert">
                   <InfoCircleOutlined />
                   <div>
                     <strong>JSON Error</strong>
                     <p style={{ margin: 0, opacity: 0.8 }}>Invalid Config</p>
                   </div>
                 </div>
              )}
              
              <div className="settings-card">
                {filteredSettings.length === 0 && (
                   <div className="empty-state">
                     <div className="empty-state-icon">🔍</div>
                     <div className="empty-state-text">No settings found</div>
                   </div>
                )}

	                {filteredSettings.map((def, index) => {
	                  const value = formValues[def.key]
	                  const isLast = index === filteredSettings.length - 1
	                  
                  // 为什么：agent 使用卡片网格布局，每个 Agent 类型一张卡片，支持模型选择和自定义添加
                  if (def.kind === 'complex' && def.key === 'agent') {
                    const rowBorder = isLast ? 'none' : '1px solid #f0f0f0'
                    // 为什么：合并内置类型和用户自定义类型，确保所有配置都能展示
                    const allAgentTypes = Array.from(new Set([
                      ...BUILTIN_AGENT_TYPES,
                      ...Object.keys(agentDraft)
                    ]))
                    return (
                      <div key={def.key}>
                        <div
                          className="setting-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            borderBottom: 'none',
                            minHeight: 60,
                          }}
                        >
                          <div style={{ flex: 1, paddingRight: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                              <Text className="setting-key">{def.title}</Text>
                            </div>
                            <Text className="setting-desc" style={{ whiteSpace: 'pre-wrap' }}>{def.description}</Text>
                            <div className="setting-default">Default: {def.defaultHint}</div>
                          </div>

                          <div style={{ width: 240, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>
                              {formatComplexValue(previewConfig.agent)} <InfoCircleOutlined />
                            </Text>
                            <Button size="small" onClick={resetAgentDraft}>
                              重置
                            </Button>
                          </div>
                        </div>

                        {/* 卡片网格 */}
                        <div style={{ borderBottom: rowBorder, padding: '0 20px 16px 20px' }}>
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: 12,
                            paddingTop: 8,
                          }}>
                            {allAgentTypes.map((agentType) => {
                              const isBuiltin = BUILTIN_AGENT_TYPES.includes(agentType as typeof BUILTIN_AGENT_TYPES[number])
                              const config = agentDraft[agentType] ?? {}
                              const currentModel = config.model ?? ''

                              return (
                                <Card
                                  key={agentType}
                                  size="small"
                                  title={
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <RobotOutlined style={{ color: isBuiltin ? '#007AFF' : '#8e44ad' }} />
                                      <span>{agentType}</span>
                                      {isBuiltin && <Tag color="blue" style={{ fontSize: 10, marginLeft: 4 }}>内置</Tag>}
                                    </div>
                                  }
                                  extra={
                                    !isBuiltin && (
                                      <Popconfirm
                                        title="确定删除此代理配置？"
                                        onConfirm={() => removeAgent(agentType)}
                                        okText="删除"
                                        cancelText="取消"
                                      >
                                        <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                                      </Popconfirm>
                                    )
                                  }
                                  style={{
                                    borderRadius: 8,
                                    border: currentModel ? '1px solid #007AFF' : '1px solid #e5e5e5',
                                  }}
                                >
                                  <div style={{ marginBottom: 8 }}>
                                    <Text style={{ fontSize: 12, color: '#86868b' }}>模型 (provider_id/model_id)</Text>
                                  </div>
                                  <Input
                                    style={{ width: '100%' }}
                                    value={currentModel}
                                    onChange={(e) => updateAgentModel(agentType, e.target.value)}
                                    placeholder="例如 anthropic/claude-haiku-4-20250514"
                                    allowClear
                                  />
                                  {!currentModel && (
                                    <Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
                                      留空 = 使用全局 model
                                    </Text>
                                  )}
                                </Card>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (def.kind === 'complex' && def.key === 'commit') {
	                    const rowBorder = isLast ? 'none' : '1px solid #f0f0f0'
	                    return (
                      <div key={def.key}>
                        <div
                          className="setting-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            borderBottom: 'none',
                            minHeight: 60,
                          }}
                        >
                          <div style={{ flex: 1, paddingRight: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Text style={{ fontSize: 14, fontWeight: 500 }}>{def.title}</Text>
                            </div>
                                                    <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{def.description}</Text>
                                                    <div style={{ marginTop: 2 }}>
                                                       <Text type="secondary" style={{ fontSize: 10, opacity: 0.7 }}>Default: {def.defaultHint}</Text>
                                                    </div>
                          </div>

                          <div style={{ width: 240, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>
                              {formatComplexValue(previewConfig.commit)} <InfoCircleOutlined />
                            </Text>
                            <Button size="small" onClick={resetCommitDraft}>
                              重置
                            </Button>
                          </div>
                        </div>

                        <div style={{ borderBottom: rowBorder, padding: '0 20px 16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8 }}>
                            <Text style={{ fontSize: 12 }}>language</Text>
                            <Input
                              style={{ width: 240, textAlign: 'right' }}
                              placeholder="默认：en"
                              value={commitDraft.language ?? ''}
                              onChange={(e) => updateCommitDraft({ language: e.target.value })}
                              allowClear
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 8 }}>
                            <Text style={{ fontSize: 12 }}>model</Text>
                            <Input
                              style={{ width: 240, textAlign: 'right' }}
                              placeholder="provider_id/model_id（留空=全局默认）"
                              value={commitDraft.model ?? ''}
                              onChange={(e) => updateCommitDraft({ model: e.target.value })}
                              allowClear
                            />
                          </div>

                          <div style={{ paddingTop: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <Text style={{ fontSize: 12 }}>systemPrompt</Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                追加到默认提示后面
                              </Text>
                            </div>
                            <Input.TextArea
                              placeholder="留空=不追加"
                              value={commitDraft.systemPrompt ?? ''}
                              onChange={(e) => updateCommitDraft({ systemPrompt: e.target.value })}
                              autoSize={{ minRows: 3, maxRows: 10 }}
                            />
                        </div>
                      </div>
	                      </div>
                    )
                  }

                  // 为什么：mcpServers 使用弹窗编辑器，点击按钮打开 Modal
                  if (def.kind === 'complex' && def.key === 'mcpServers') {
                    const hasContent = mcpServersDraft.trim().length > 0
                    let serverCount = 0
                    if (hasContent && !mcpServersError) {
                      const parsed = safeJsonParse(mcpServersDraft)
                      if (parsed.ok && isPlainObject(parsed.value)) {
                        serverCount = Object.keys(parsed.value).length
                      }
                    }
                    return (
                      <div
                        key={def.key}
                        className="setting-row"
                        style={{ animationDelay: `${index * 0.02}s` }}
                      >
                        <div className="setting-info">
                          <div className="setting-header">
                            <Text className="setting-key">{def.title}</Text>
                            {serverCount > 0 && (
                              <Tag color="blue" style={{ margin: 0 }}>
                                {serverCount} 个服务器
                              </Tag>
                            )}
                          </div>
                          <Text className="setting-desc">{def.description}</Text>
                          <div className="setting-default">Default: {def.defaultHint}</div>
                        </div>

                        <div className="setting-control">
                          <Button size="small" onClick={() => setMcpServersModalOpen(true)}>
                            编辑
                          </Button>
                        </div>
                      </div>
                    )
                  }

                  if (def.kind === 'complex' && def.key === 'skills') {
                    const rowBorder = isLast ? 'none' : '1px solid #f0f0f0'
                    return (
                      <div key={def.key}>
                        <div
                          className="setting-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            borderBottom: 'none',
                            minHeight: 60,
                          }}
                        >
                          <div style={{ flex: 1, paddingRight: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Text style={{ fontSize: 14, fontWeight: 500 }}>{def.title}</Text>
                            </div>
                            <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                              {def.description}
                            </Text>
                            <div style={{ marginTop: 2 }}>
                              <Text type="secondary" style={{ fontSize: 10, opacity: 0.7 }}>
                                Default: {def.defaultHint}
                              </Text>
                            </div>
                          </div>

                          <div style={{ width: 240, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>
                              {formatComplexValue(previewConfig.skills)} <InfoCircleOutlined />
                            </Text>
                          </div>
                        </div>

                        <div style={{ borderBottom: rowBorder, padding: '0 20px 16px 20px' }}>
                          <div style={{ paddingTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              仅提供迁移入口，skills 配置请在 JSON 预览区直接编辑。
                            </Text>
                          </div>

                          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed #e5e5e5' }}>
                            <Text style={{ fontSize: 12, fontWeight: 500 }}>一键迁移</Text>
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                                paddingTop: 8,
                              }}
                            >
                              <Text style={{ fontSize: 12 }}>源目录</Text>
                              <Input
                                style={{ width: '100%' }}
                                placeholder="例如 /Users/you/.claude/skills"
                                value={skillsSourcePath}
                                onChange={(e) => setSkillsSourcePath(e.target.value)}
                                allowClear
                              />
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 6,
                                paddingTop: 8,
                              }}
                            >
                              <Text style={{ fontSize: 12 }}>目标目录</Text>
                              <Input
                                style={{ width: '100%' }}
                                placeholder="例如 /Users/you/.neovate/skills"
                                value={skillsTargetPath}
                                onChange={(e) => setSkillsTargetPath(e.target.value)}
                                allowClear
                              />
                            </div>

                            <div style={{ paddingTop: 10 }}>
                              <Button size="small" onClick={runSkillsMigration} loading={skillsBusy}>
                                一键迁移
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  if (def.kind === 'complex' && def.key === 'plugins') {
                    const rowBorder = isLast ? 'none' : '1px solid #f0f0f0'
                    return (
                      <div key={def.key}>
                        <div
                          className="setting-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '16px 20px',
                            borderBottom: 'none',
                            minHeight: 60,
                          }}
                        >
                          <div style={{ flex: 1, paddingRight: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Text style={{ fontSize: 14, fontWeight: 500 }}>{def.title}</Text>
                              {builtinNotifyEnabled && (
                                <Tag color="blue" style={{ margin: 0 }}>
                                  已启用
                                </Tag>
                              )}
                            </div>
                            <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
                              {def.description}
                            </Text>
                            <div style={{ marginTop: 2 }}>
                              <Text type="secondary" style={{ fontSize: 10, opacity: 0.7 }}>
                                Default: {def.defaultHint}
                              </Text>
                            </div>
                          </div>

                          <div style={{ width: 240, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>
                              {formatComplexValue(previewConfig.plugins)} <InfoCircleOutlined />
                            </Text>
                          </div>
                        </div>

                        <div style={{ borderBottom: rowBorder, padding: '0 20px 16px 20px' }}>
                          <div style={{ paddingTop: 8 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              内置插件（可选启用）：开启后会把插件文件写入 ~/.neovate/plugins/ 并把路径加入 plugins。
                            </Text>
                          </div>

                          <Card size="small" style={{ marginTop: 12, borderRadius: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                              <div style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: 500 }}>notify</Text>
                                <div style={{ marginTop: 4 }}>
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    stop 时发送系统通知（依赖 terminal-notifier）
                                  </Text>
                                </div>
                                {builtinNotifyEntry && (
                                  <div style={{ marginTop: 6 }}>
                                    <Text type="secondary" style={{ fontSize: 11 }}>
                                      路径：{builtinNotifyEntry}
                                    </Text>
                                  </div>
                                )}
                              </div>

                              <Switch
                                checked={builtinNotifyEnabled}
                                disabled={builtinNotifyBusy}
                                onChange={(checked) => {
                                  if (checked) void enableBuiltinNotify()
                                  else disableBuiltinNotify()
                                }}
                              />
                            </div>
                          </Card>
                        </div>
                      </div>
                    )
                  }

                  if (def.kind === 'complex' && def.key === 'notification') {
                    const rowBorder = isLast ? 'none' : '1px solid #f0f0f0'
	                    const webhookUrl = notificationDraft.webhookUrl.trim()
	                    const webhookLooksValid =
	                      webhookUrl === '' || webhookUrl.startsWith('http://') || webhookUrl.startsWith('https://')

	                    const pickedSound = (notificationDraft.soundName || '').trim()
	                    const isKnownMacSound = MACOS_SOUNDS.includes(pickedSound as (typeof MACOS_SOUNDS)[number])

	                    return (
	                      <div key={def.key}>
	                        <div
	                          className="setting-row"
	                          style={{
	                            display: 'flex',
	                            alignItems: 'center',
	                            justifyContent: 'space-between',
	                            padding: '16px 20px',
	                            borderBottom: 'none',
	                            minHeight: 60,
	                          }}
	                        >
	                          <div style={{ flex: 1, paddingRight: 20 }}>
	                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
	                              <Text style={{ fontSize: 14, fontWeight: 500 }}>{def.title}</Text>
	                            </div>
	                            <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
	                              {def.description}
	                            </Text>
	                            <div style={{ marginTop: 2 }}>
	                              <Text type="secondary" style={{ fontSize: 10, opacity: 0.7 }}>
	                                Default: {def.defaultHint}
	                              </Text>
	                            </div>
	                          </div>

	                          <div style={{ width: 240, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
	                            <Text type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>
	                              {formatComplexValue(previewConfig.notification)} <InfoCircleOutlined />
	                            </Text>
	                            <Button size="small" onClick={resetNotificationDraft}>
	                              重置
	                            </Button>
	                          </div>
	                        </div>

	                        <div style={{ borderBottom: rowBorder, padding: '0 20px 16px 20px' }}>
	                          <div
	                            style={{
	                              display: 'flex',
	                              alignItems: 'center',
	                              justifyContent: 'space-between',
	                              gap: 12,
	                              paddingTop: 8,
	                            }}
	                          >
	                            <Text style={{ fontSize: 12 }}>模式</Text>
	                            <Select
	                              value={notificationDraft.mode}
	                              style={{ width: 240 }}
	                              onChange={(v) => {
	                                const mode = v as NotificationMode
	                                if (mode === 'webhook') {
	                                  updateNotificationDraft({ mode, webhookUrl: notificationDraft.webhookUrl, soundName: '' })
	                                  return
	                                }
	                                if (mode === 'sound') {
	                                  updateNotificationDraft({ mode, soundName: notificationDraft.soundName, webhookUrl: '' })
	                                  return
	                                }
	                                updateNotificationDraft({ mode, soundName: '', webhookUrl: '' })
	                              }}
	                            >
	                              <Option value="off">禁用（默认）</Option>
	                              <Option value="defaultSound">默认声音（Funk）</Option>
	                              <Option value="sound">指定声音</Option>
	                              <Option value="webhook">Webhook URL（HTTP GET）</Option>
	                            </Select>
	                          </div>

	                          {notificationDraft.mode === 'defaultSound' && (
	                            <div style={{ paddingTop: 8 }}>
	                              <Text type="secondary" style={{ fontSize: 12 }}>
	                                macOS 会播放系统声音；Linux/Windows 会回退到终端响铃。
	                              </Text>
	                            </div>
	                          )}

	                          {notificationDraft.mode === 'sound' && (
	                            <>
	                              <div
	                                style={{
	                                  display: 'flex',
	                                  alignItems: 'center',
	                                  justifyContent: 'space-between',
	                                  gap: 12,
	                                  paddingTop: 8,
	                                }}
	                              >
	                                <Text style={{ fontSize: 12 }}>macOS 系统声音</Text>
	                                <Select
	                                  value={isKnownMacSound ? pickedSound : undefined}
	                                  placeholder="选择一个（可选）"
	                                  style={{ width: 240 }}
	                                  onChange={(v) => updateNotificationDraft({ soundName: String(v) })}
	                                  allowClear
	                                >
	                                  {MACOS_SOUNDS.map((s) => (
	                                    <Option key={s} value={s}>
	                                      {s}
	                                    </Option>
	                                  ))}
	                                </Select>
	                              </div>

	                              <div
	                                style={{
	                                  display: 'flex',
	                                  alignItems: 'center',
	                                  justifyContent: 'space-between',
	                                  gap: 12,
	                                  paddingTop: 8,
	                                }}
	                              >
	                                <Text style={{ fontSize: 12 }}>名称</Text>
	                                <Input
	                                  style={{ width: 240, textAlign: 'right' }}
	                                  placeholder='例如 "Glass" / "Ping"'
	                                  value={notificationDraft.soundName}
	                                  onChange={(e) => updateNotificationDraft({ soundName: e.target.value })}
	                                  allowClear
	                                />
	                              </div>

	                              <div style={{ paddingTop: 8 }}>
	                                <Text type="secondary" style={{ fontSize: 12 }}>
	                                  macOS 使用 /System/Library/Sounds/；Linux/Windows 会回退到终端响铃。
	                                </Text>
	                              </div>
	                            </>
	                          )}

	                          {notificationDraft.mode === 'webhook' && (
	                            <>
	                              <div
	                                style={{
	                                  display: 'flex',
	                                  alignItems: 'center',
	                                  justifyContent: 'space-between',
	                                  gap: 12,
	                                  paddingTop: 8,
	                                }}
	                              >
	                                <Text style={{ fontSize: 12 }}>URL</Text>
	                                <Input
	                                  style={{ width: 240, textAlign: 'right' }}
	                                  placeholder="https://example.com/hook?cwd={{cwd}}&name={{name}}"
	                                  value={notificationDraft.webhookUrl}
	                                  onChange={(e) => updateNotificationDraft({ webhookUrl: e.target.value })}
	                                  allowClear
	                                />
	                              </div>

	                              {!webhookLooksValid && (
	                                <div style={{ paddingTop: 8 }}>
	                                  <Text type="danger" style={{ fontSize: 12 }}>
	                                    URL 必须以 http:// 或 https:// 开头（否则不会被当作 Webhook）。
	                                  </Text>
	                                </div>
	                              )}

	                              <div style={{ paddingTop: 8 }}>
	                                <Text type="secondary" style={{ fontSize: 12 }}>
		                                  支持模板变量：{'{{cwd}}'}（项目根目录）、{'{{name}}'}（目录名）。
		                                </Text>
		                              </div>
	                            </>
	                          )}
	                        </div>
	                      </div>
	                    )
	                  }

	                  if (def.kind === 'complex' && def.key === 'desktop') {
	                    const rowBorder = isLast ? 'none' : '1px solid #f0f0f0'
	                    const themeValue = desktopDraft.theme ?? 'default'
	                    const sendValue = desktopDraft.sendMessageWith ?? 'default'
	                    const fontSizeText = desktopDraft.terminalFontSize === undefined ? '' : String(desktopDraft.terminalFontSize)

	                    return (
	                      <div key={def.key}>
	                        <div
	                          className="setting-row"
	                          style={{
	                            display: 'flex',
	                            alignItems: 'center',
	                            justifyContent: 'space-between',
	                            padding: '16px 20px',
	                            borderBottom: 'none',
	                            minHeight: 60,
	                          }}
	                        >
	                          <div style={{ flex: 1, paddingRight: 20 }}>
	                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
	                              <Text style={{ fontSize: 14, fontWeight: 500 }}>{def.title}</Text>
	                            </div>
	                            <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>
	                              {def.description}
	                            </Text>
	                            <div style={{ marginTop: 2 }}>
	                              <Text type="secondary" style={{ fontSize: 10, opacity: 0.7 }}>
	                                Default: {def.defaultHint}
	                              </Text>
	                            </div>
	                            <div style={{ marginTop: 6 }}>
	                              <Text type="secondary" style={{ fontSize: 11 }}>
	                                仅对全局配置生效，工作区配置会被忽略。
	                              </Text>
	                            </div>
	                          </div>

	                          <div style={{ width: 240, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
	                            <Text type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>
	                              {formatComplexValue(previewConfig.desktop)} <InfoCircleOutlined />
	                            </Text>
	                            <Button size="small" onClick={resetDesktopDraft}>
	                              重置
	                            </Button>
	                          </div>
	                        </div>

	                        <div style={{ borderBottom: rowBorder, padding: '0 20px 16px 20px' }}>
	                          <div
	                            style={{
	                              display: 'flex',
	                              alignItems: 'center',
	                              justifyContent: 'space-between',
	                              gap: 12,
	                              paddingTop: 8,
	                            }}
	                          >
	                            <Text style={{ fontSize: 12 }}>theme</Text>
	                            <Select
	                              value={themeValue}
	                              style={{ width: 240 }}
	                              onChange={(v) =>
	                                updateDesktopDraft({ theme: v === 'default' ? undefined : (v as DesktopTheme) })
	                              }
	                            >
	                              <Option value="default">Default</Option>
	                              <Option value="light">light</Option>
	                              <Option value="dark">dark</Option>
	                              <Option value="system">system</Option>
	                            </Select>
	                          </div>

	                          <div
	                            style={{
	                              display: 'flex',
	                              alignItems: 'center',
	                              justifyContent: 'space-between',
	                              gap: 12,
	                              paddingTop: 8,
	                            }}
	                          >
	                            <Text style={{ fontSize: 12 }}>sendMessageWith</Text>
	                            <Select
	                              value={sendValue}
	                              style={{ width: 240 }}
	                              onChange={(v) =>
	                                updateDesktopDraft({ sendMessageWith: v === 'default' ? undefined : (v as DesktopSendMessageWith) })
	                              }
	                            >
	                              <Option value="default">Default</Option>
	                              <Option value="enter">enter</Option>
	                              <Option value="cmdEnter">cmdEnter</Option>
	                            </Select>
	                          </div>

	                          <div
	                            style={{
	                              display: 'flex',
	                              alignItems: 'center',
	                              justifyContent: 'space-between',
	                              gap: 12,
	                              paddingTop: 8,
	                            }}
	                          >
	                            <Text style={{ fontSize: 12 }}>terminalFont</Text>
	                            <Input
	                              style={{ width: 240, textAlign: 'right' }}
	                              placeholder="默认字体"
	                              value={desktopDraft.terminalFont ?? ''}
	                              onChange={(e) =>
	                                updateDesktopDraft({ terminalFont: e.target.value === '' ? undefined : e.target.value })
	                              }
	                              allowClear
	                            />
	                          </div>

	                          <div
	                            style={{
	                              display: 'flex',
	                              alignItems: 'center',
	                              justifyContent: 'space-between',
	                              gap: 12,
	                              paddingTop: 8,
	                            }}
	                          >
	                            <Text style={{ fontSize: 12 }}>terminalFontSize</Text>
	                            <Input
	                              style={{ width: 240, textAlign: 'right' }}
	                              placeholder="默认字号"
	                              value={fontSizeText}
	                              onChange={(e) => {
	                                const raw = e.target.value
	                                if (raw.trim() === '') {
	                                  updateDesktopDraft({ terminalFontSize: undefined })
	                                  return
	                                }
	                                const num = Number(raw)
	                                if (!Number.isNaN(num)) updateDesktopDraft({ terminalFontSize: num })
	                              }}
	                              allowClear
	                            />
	                          </div>
	                        </div>
	                      </div>
	                    )
	                  }

	                  return (
	                    <div 
	                      key={def.key} 
	                      className="setting-row"
                      style={{ 
                        animationDelay: `${index * 0.02}s`
                      }}
                    >
                      <div className="setting-info">
                        <div className="setting-header">
                          <Text className="setting-key">{def.title}</Text>
                          {def.key === 'approvalMode' && <span className="setting-tag">Recommended</span>}
                        </div>
                        <Text className="setting-desc">{def.description}</Text>
                        <div className="setting-default">Default: {def.defaultHint}</div>
                      </div>

                      <div className="setting-control">
                        
                        {/* Boolean: Switch */}
                        {def.kind === 'boolean' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                             <Switch 
                               checked={value === true}
                               onChange={(checked) => setFormValues(prev => ({ ...prev, [def.key]: checked }))} 
                             />
                             {value === undefined && <Tag color="default" style={{margin: 0}}>Default</Tag>}
                             {/* Allow clearing to default for booleans is tricky with just a switch. 
                                 For true Apple style, usually 'default' is implied by the switch state 
                                 OR we need a separate "Reset" action. 
                                 Here, let's just use the Switch. If they want 'undefined', they might need to edit JSON 
                                 or we add a clear button. For now, keep simple. 
                             */}
                          </div>
                        )}

                        {/* Enum: Select */}
                        {def.kind === 'enum' && (
                           <Select
                             value={value === undefined ? 'default' : String(value)}
                             style={{ width: 140 }}
                             onChange={(v) => {
                                setFormValues(prev => ({ ...prev, [def.key]: v === 'default' ? undefined : v }))
                             }}
                           >
                             <Option value="default">Default</Option>
                             {def.options?.map(opt => <Option key={opt} value={opt}>{opt}</Option>)}
                           </Select>
                        )}

                        {/* String/Number: Input */}
                        {def.kind === 'number' && (
                           <Input 
                              style={{ textAlign: 'right' }}
                              placeholder="Default"
                              value={value === undefined ? '' : String(value)}
                              onChange={(e) => {
                                 const raw = e.target.value
                                 if (raw.trim() === '') setFormValues(prev => ({...prev, [def.key]: undefined}))
                                 else if (!isNaN(Number(raw))) setFormValues(prev => ({...prev, [def.key]: Number(raw)}))
                              }}
                           />
                        )}
                        {/* systemPrompt 用大文本框 */}
                        {def.kind === 'string' && def.key === 'systemPrompt' && (
                           <Input.TextArea
                              placeholder="Default"
                              value={value === undefined ? '' : String(value)}
                              onChange={(e) => {
                                 const raw = e.target.value
                                 setFormValues(prev => ({...prev, [def.key]: raw === '' ? undefined : raw}))
                              }}
                              autoSize={{ minRows: 3, maxRows: 10 }}
                           />
                        )}
                        {/* 其他 string 类型用普通输入框 */}
                        {def.kind === 'string' && def.key !== 'systemPrompt' && (
                           <Input 
                              style={{ textAlign: 'right' }}
                              placeholder="Default"
                              value={value === undefined ? '' : String(value)}
                              onChange={(e) => {
                                 const raw = e.target.value
                                 setFormValues(prev => ({...prev, [def.key]: raw === '' ? undefined : raw}))
                              }}
                           />
                        )}

                        {/* Complex: Readonly Label */}
                        {def.kind === 'complex' && def.key !== 'commit' && (
                          <Text type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>
                            {formatComplexValue(baseConfig[def.key])} <InfoCircleOutlined />
                          </Text>
                        )}

                      </div>
                    </div>
                  )
                })}
              </div>
              
              <div className="settings-footer">
                 Neovate Configuration
             </div>

            </div>
          </div>

          {/* 为什么：可拖拽的分割线，用于调整左右面板宽度 */}
          <div
            className="resizer-divider"
            onMouseDown={handleDividerMouseDown}
          />

          {/* 为什么：北欧风格的 JSON 预览面板 */}
          <div className="json-panel" style={{ width: rightPanelWidth }}>
             <div className="json-panel-header">
                JSON Preview
             </div>
             <div className="json-panel-content">
               <CodeMirror
                  value={previewText}
                  height="100%"
                  theme={oneDark}
                  extensions={[json()]}
                  editable={false}
                  readOnly
                  style={{ height: '100%', fontFamily: "'JetBrains Mono', Menlo, Monaco, monospace", fontSize: 12 }}
                />
             </div>
          </div>

        </Content>
      </Layout>

      {/* 为什么：mcpServers 编辑弹窗，支持粘贴 JSON 后格式化 */}
      <Modal
        title="编辑 MCP Servers"
        open={mcpServersModalOpen}
        onCancel={() => setMcpServersModalOpen(false)}
        width={600}
        footer={[
          <Button key="reset" onClick={resetMcpServersDraft}>
            清空
          </Button>,
          <Button key="format" onClick={formatMcpServersDraft} disabled={!mcpServersDraft.trim() || !!mcpServersError}>
            格式化
          </Button>,
          <Button key="close" type="primary" onClick={() => setMcpServersModalOpen(false)}>
            完成
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            从文档复制 MCP Server 配置后直接粘贴，点击「格式化」整理格式。
          </Text>
        </div>
        <Input.TextArea
          value={mcpServersDraft}
          onChange={(e) => updateMcpServersDraft(e.target.value)}
          placeholder={`粘贴 JSON 配置，例如：
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
  },
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": { "GITHUB_TOKEN": "your-token" }
  }
}`}
          autoSize={{ minRows: 10, maxRows: 20 }}
          style={{
            fontFamily: "'JetBrains Mono', Menlo, Monaco, monospace",
            fontSize: 12,
          }}
        />
        {mcpServersError && (
          <Text type="danger" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            {mcpServersError}
          </Text>
        )}
        {!mcpServersError && mcpServersDraft.trim() && (
          <Text type="success" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
            ✓ JSON 格式正确
          </Text>
        )}
      </Modal>

      <Modal
        title="技能迁移冲突"
        open={skillsModalOpen}
        onCancel={() => {
          setSkillsModalOpen(false)
          setSkillsPlan(null)
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setSkillsModalOpen(false)
              setSkillsPlan(null)
            }}
          >
            取消
          </Button>,
          <Button
            key="skip"
            onClick={() => {
              setSkillsModalOpen(false)
              void applySkillsMigration('skip')
              setSkillsPlan(null)
            }}
          >
            跳过冲突并继续
          </Button>,
          <Button
            key="replace"
            type="primary"
            onClick={() => {
              setSkillsModalOpen(false)
              void applySkillsMigration('replace')
              setSkillsPlan(null)
            }}
          >
            替换冲突并继续
          </Button>,
        ]}
      >
        <Text style={{ fontSize: 13 }}>
          检测到 {skillsPlan?.conflictCount ?? 0} 项同名目录或文件已存在，是否进行替换？
        </Text>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            源目录：{skillsSourcePath || '未填写'}
          </Text>
        </div>
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            目标目录：{skillsTargetPath || '未填写'}
          </Text>
        </div>
      </Modal>
    </ConfigProvider>
  )
}
