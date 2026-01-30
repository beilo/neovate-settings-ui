// 为什么：集中管理配置类型，减少组件噪音并统一出口。

export type SettingKind = 'enum' | 'boolean' | 'string' | 'number' | 'complex'

export type SettingDef = {
  key: string
  kind: SettingKind
  title: string
  description: string
  defaultHint: string
  options?: string[]
}

export type FormValue = string | number | boolean | undefined

export type FormState = Record<string, FormValue>

// 为什么：Agent 配置目前仅支持 model，便于后续扩展。
export type AgentConfig = {
  model?: string
}

export type AgentDraft = Record<string, AgentConfig>

export type CommitConfig = {
  language?: string
  systemPrompt?: string
  model?: string
}

export type NotificationMode = 'off' | 'defaultSound' | 'sound' | 'webhook'

export type NotificationDraft = {
  mode: NotificationMode
  soundName: string
  webhookUrl: string
}

export type DesktopTheme = 'light' | 'dark' | 'system'

export type DesktopSendMessageWith = 'enter' | 'cmdEnter'

export type DesktopDraft = {
  theme?: DesktopTheme
  sendMessageWith?: DesktopSendMessageWith
  terminalFont?: string
  terminalFontSize?: number
}

export type ReadConfigResponse = {
  path: string
  exists: boolean
  content: string
}

export type SkillsMigrationItem = {
  name: string
  source: string
  target: string
  exists: boolean
  isDir: boolean
}

export type SkillsMigrationPlan = {
  items: SkillsMigrationItem[]
  conflictCount: number
}

export type SkillsMigrationResult = {
  copied: number
  skipped: number
  replaced: number
}

export type InstallBuiltinPluginResponse = {
  id: string
  // 为什么：返回实际路径，前端写入配置以确保可加载。
  path: string
  wrote: boolean
}
