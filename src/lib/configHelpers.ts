// 为什么：配置相关纯函数集中，避免 UI 里散落逻辑。

import type {
  AgentDraft,
  CommitConfig,
  DesktopDraft,
  FormState,
  NotificationDraft,
} from './configTypes'
import { SETTINGS } from './settingsSchema'

export function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(text) }
  } catch (e) {
    return { ok: false, message: String(e) }
  }
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function stringifyConfig(config: Record<string, unknown>): string {
  return `${JSON.stringify(config, null, 2)}\n`
}

export function pickFormValues(config: Record<string, unknown>): FormState {
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

export function applyFormValues(base: Record<string, unknown>, form: FormState): Record<string, unknown> {
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

export function formatComplexValue(value: unknown): string {
  if (value === undefined) return '未设置'
  try {
    const raw = JSON.stringify(value)
    return raw.length > 60 ? `${raw.slice(0, 60)}…` : raw
  } catch {
    return '（无法展示）'
  }
}

export function pickStringArray(value: unknown): string[] {
  // 为什么：plugins 等字段是数组，但用户可能手改成其他类型；这里兜底为字符串数组。
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function normalizePathForCompare(value: string): string {
  // 为什么：统一分隔符，避免 Windows/Unix 路径差异影响判断。
  return value.replace(/\\/g, '/')
}

export function isBuiltinNotifyPluginEntry(value: string, builtinPath?: string): boolean {
  // 为什么：兼容旧配置 builtin:notify，同时优先匹配实际文件路径。
  if (value === 'builtin:notify') return true
  if (builtinPath) {
    const normalizedValue = normalizePathForCompare(value)
    const normalizedBuiltin = normalizePathForCompare(builtinPath)
    if (normalizedValue === normalizedBuiltin) return true
  }
  return /[\\/]\.neovate[\\/]plugins[\\/]notify\.js$/.test(value)
}

// 为什么：从配置中提取 agent 字段，转换为 UI 可编辑的 AgentDraft。
export function pickAgentDraft(value: unknown): AgentDraft {
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

// 为什么：将 AgentDraft 归一化为配置格式，空对象不写入。
export function normalizeAgentConfig(draft: AgentDraft): AgentDraft | undefined {
  const next: AgentDraft = {}
  for (const [key, config] of Object.entries(draft)) {
    const model = config.model?.trim()
    if (model) {
      next[key] = { model }
    }
  }
  return Object.keys(next).length === 0 ? undefined : next
}

export function pickCommitConfig(value: unknown): CommitConfig | undefined {
  if (!isPlainObject(value)) return undefined
  const next: CommitConfig = {}
  if (typeof value.language === 'string') next.language = value.language
  if (typeof value.systemPrompt === 'string') next.systemPrompt = value.systemPrompt
  if (typeof value.model === 'string') next.model = value.model
  return Object.keys(next).length === 0 ? undefined : next
}

export function normalizeCommitConfig(draft: CommitConfig): CommitConfig | undefined {
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

export function pickNotificationDraft(value: unknown): NotificationDraft {
  if (value === true) return { mode: 'defaultSound', soundName: '', webhookUrl: '' }
  if (value === false || value === undefined) return { mode: 'off', soundName: '', webhookUrl: '' }
  if (typeof value !== 'string') return { mode: 'off', soundName: '', webhookUrl: '' }

  const trimmed = value.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return { mode: 'webhook', soundName: '', webhookUrl: trimmed }
  }
  return { mode: 'sound', soundName: trimmed, webhookUrl: '' }
}

export function normalizeNotificationValue(draft: NotificationDraft): boolean | string | undefined {
  if (draft.mode === 'off') return undefined
  if (draft.mode === 'defaultSound') return true
  if (draft.mode === 'sound') {
    const sound = draft.soundName.trim()
    return sound ? sound : undefined
  }
  const url = draft.webhookUrl.trim()
  return url ? url : undefined
}

export function pickDesktopDraft(value: unknown): DesktopDraft {
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

export function normalizeDesktopConfig(draft: DesktopDraft): DesktopDraft | undefined {
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

export function inferHomeFromConfigPath(path: string): string | null {
  if (!path) return null
  if (path.endsWith('/.neovate/config.json')) return path.slice(0, -'/.neovate/config.json'.length)
  if (path.endsWith('\\.neovate\\config.json')) return path.slice(0, -'\\.neovate\\config.json'.length)
  return null
}
