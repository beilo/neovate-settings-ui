import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { appLocalDataDir } from '@tauri-apps/api/path'
import { message } from 'antd'
import type {
  AgentDraft,
  CommitConfig,
  DesktopDraft,
  FormState,
  FormValue,
  NotificationDraft,
  ReadConfigResponse,
  SkillsMigrationPlan,
  SkillsMigrationResult,
  InstallBuiltinPluginResponse,
} from '../lib/configTypes'
import {
  applyFormValues,
  inferHomeFromConfigPath,
  isBuiltinNotifyPluginEntry,
  isPlainObject,
  normalizeAgentConfig,
  normalizeCommitConfig,
  normalizeDesktopConfig,
  normalizeNotificationValue,
  pickAgentDraft,
  pickCommitConfig,
  pickDesktopDraft,
  pickFormValues,
  pickNotificationDraft,
  pickStringArray,
  safeJsonParse,
  stringifyConfig,
} from '../lib/configHelpers'
import { SETTINGS } from '../lib/settingsSchema'

// 为什么：集中管理配置状态与动作，减少顶层组件复杂度。
export function useConfigState() {
  const [configPath, setConfigPath] = useState<string>('')
  const [exists, setExists] = useState<boolean>(true)
  const [sourceText, setSourceText] = useState<string>(`{\n}\n`)
  const [baseConfig, setBaseConfig] = useState<Record<string, unknown>>({})
  const [formValues, setFormValues] = useState<FormState>({})
  const [searchText, setSearchText] = useState<string>('')
  const loadedTextRef = useRef<string>('{\\n}\\n')

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
  // 为什么：mcpServers 用 JSON 字符串草稿，支持粘贴后格式化。
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
  const [builtinNotifyPath, setBuiltinNotifyPath] = useState<string>('')

  const parse = useMemo(() => safeJsonParse(sourceText), [sourceText])
  const isValid = parse.ok
  const previewConfig = useMemo(() => applyFormValues(baseConfig, formValues), [baseConfig, formValues])
  const previewText = useMemo(() => stringifyConfig(previewConfig), [previewConfig])
  const dirty = previewText !== loadedTextRef.current
  const builtinNotifyEntry = useMemo(() => {
    const plugins = pickStringArray((previewConfig as Record<string, unknown>).plugins)
    return plugins.find((entry) => isBuiltinNotifyPluginEntry(entry, builtinNotifyPath))
  }, [previewConfig, builtinNotifyPath])
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
    // 为什么：检测旧的 builtin:notify，若已拿到真实路径则先在内存中替换。
    if (builtinNotifyPath) {
      const rawPlugins = pickStringArray(base.plugins)
      const migratedPlugins = rawPlugins.map((p) => (p === 'builtin:notify' ? builtinNotifyPath : p))
      if (JSON.stringify(rawPlugins) !== JSON.stringify(migratedPlugins)) {
        base.plugins = migratedPlugins
      }
    }
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
    // 为什么：agent 是 Record<string, AgentConfig>，需要单独草稿支持卡片编辑。
    setAgentDraft(pickAgentDraft(base.agent))
    // 为什么：mcpServers 用 JSON 字符串存储，方便粘贴和格式化。
    const mcpValue = base.mcpServers
    if (mcpValue !== undefined && isPlainObject(mcpValue) && Object.keys(mcpValue).length > 0) {
      setMcpServersDraft(JSON.stringify(mcpValue, null, 2))
      setMcpServersError('')
    } else {
      setMcpServersDraft('')
      setMcpServersError('')
    }
    loadedTextRef.current = stringifyConfig(applyFormValues(base, picked))
  }, [builtinNotifyPath])

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

  const save = useCallback(async () => {
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
  }, [previewText, syncFromContent, messageApi])

  const enableBuiltinNotify = useCallback(async () => {
    setBuiltinNotifyBusy(true)
    try {
      const res = (await invoke('install_builtin_plugin', { id: 'notify' })) as InstallBuiltinPluginResponse
      // 为什么：后端返回实际路径，缓存起来用于后续识别与迁移。
      if (!builtinNotifyPath && res.path) {
        setBuiltinNotifyPath(res.path)
      }
      setBaseConfig((prevBase) => {
        const prevPlugins = pickStringArray((prevBase as Record<string, unknown>).plugins)
        // 为什么：用实际路径写入配置，避免 builtin 解析失败。
        const hasBuiltin = prevPlugins.some((entry) => isBuiltinNotifyPluginEntry(entry, builtinNotifyPath))
        const nextPlugins = hasBuiltin ? prevPlugins : [...prevPlugins, res.path]
        return { ...prevBase, plugins: nextPlugins }
      })
      messageApi.success(res.wrote ? '内置通知插件已写入并启用' : '内置通知插件已启用（文件已存在）')
    } catch (e) {
      messageApi.error(`启用内置通知插件失败：${String(e)}`)
    } finally {
      setBuiltinNotifyBusy(false)
    }
  }, [messageApi, builtinNotifyPath])

  const disableBuiltinNotify = useCallback(() => {
    setBaseConfig((prevBase) => {
      const prevPlugins = pickStringArray((prevBase as Record<string, unknown>).plugins)
      const nextPlugins = prevPlugins.filter((p) => !isBuiltinNotifyPluginEntry(p, builtinNotifyPath))
      const nextBase = { ...prevBase } as Record<string, unknown>
      if (nextPlugins.length === 0) delete nextBase.plugins
      else nextBase.plugins = nextPlugins
      return nextBase
    })
    messageApi.success('已禁用内置通知插件')
  }, [messageApi, builtinNotifyPath])

  const addCustomPlugin = useCallback(async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'JavaScript', extensions: ['js'] }],
    })
    if (!selected) return
    // 为什么：dialog 在单选场景只返回字符串路径，这里显式兜底数组分支。
    if (Array.isArray(selected)) return
    const filePath = selected
    setBaseConfig((prevBase) => {
      const prevPlugins = pickStringArray((prevBase as Record<string, unknown>).plugins)
      if (prevPlugins.includes(filePath)) {
        messageApi.warning('该插件已存在')
        return prevBase
      }
      const nextBase = { ...prevBase } as Record<string, unknown>
      nextBase.plugins = [...prevPlugins, filePath]
      return nextBase
    })
    messageApi.success('已添加自定义插件')
  }, [messageApi])

  const removeCustomPlugin = useCallback((pluginPath: string) => {
    setBaseConfig((prevBase) => {
      const prevPlugins = pickStringArray((prevBase as Record<string, unknown>).plugins)
      const nextPlugins = prevPlugins.filter((p) => p !== pluginPath)
      const nextBase = { ...prevBase } as Record<string, unknown>
      if (nextPlugins.length === 0) delete nextBase.plugins
      else nextBase.plugins = nextPlugins
      return nextBase
    })
    messageApi.success('已移除插件')
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

  // 为什么：更新单个 Agent 的 model，同步到 baseConfig。
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

  // 为什么：删除 Agent 配置（仅允许删除自定义 Agent）。
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

  // 为什么：重置所有 Agent 配置。
  const resetAgentDraft = useCallback(() => {
    setAgentDraft({})
    setBaseConfig((prev) => {
      const next = { ...prev }
      delete next.agent
      return next
    })
  }, [])

  // 为什么：mcpServers 用 JSON 文本编辑，支持直接粘贴配置。
  const updateMcpServersDraft = useCallback((text: string) => {
    setMcpServersDraft(text)
    if (text.trim() === '') {
      // 清空时删除 mcpServers 字段。
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

  // 为什么：格式化 JSON，让粘贴的内容更整洁。
  const formatMcpServersDraft = useCallback(() => {
    const text = mcpServersDraft.trim()
    if (!text) return
    const parsed = safeJsonParse(text)
    if (parsed.ok && isPlainObject(parsed.value)) {
      setMcpServersDraft(JSON.stringify(parsed.value, null, 2))
      setMcpServersError('')
    }
  }, [mcpServersDraft])

  // 为什么：重置 mcpServers 配置。
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
    let cancelled = false
    const resolveBuiltinPath = async () => {
      try {
        const baseDir = await appLocalDataDir()
        if (cancelled || !baseDir) return
        // 为什么：拼出内置插件写入路径，后续用于识别与迁移旧配置。
        const normalizedBase = baseDir.replace(/[\\/]+$/, '')
        setBuiltinNotifyPath(`${normalizedBase}/plugins/notify.js`)
      } catch {
        // 为什么：路径解析失败时不阻断主流程，保持降级兼容。
        if (!cancelled) setBuiltinNotifyPath('')
      }
    }
    void resolveBuiltinPath()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!builtinNotifyPath) return
    // 为什么：当旧配置包含 builtin:notify 时，自动迁移到真实路径以便可加载。
    setBaseConfig((prev) => {
      const rawPlugins = pickStringArray((prev as Record<string, unknown>).plugins)
      if (!rawPlugins.includes('builtin:notify')) return prev
      const migratedPlugins = rawPlugins.map((p) => (p === 'builtin:notify' ? builtinNotifyPath : p))
      return { ...prev, plugins: migratedPlugins }
    })
  }, [builtinNotifyPath])

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
  }, [reload])

  const updateFormValue = useCallback((key: string, value: FormValue) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const state = useMemo(() => ({
    configPath,
    exists,
    sourceText,
    baseConfig,
    formValues,
    searchText,
    commitDraft,
    notificationDraft,
    desktopDraft,
    agentDraft,
    mcpServersDraft,
    mcpServersError,
    mcpServersModalOpen,
    skillsSourcePath,
    skillsTargetPath,
    skillsBusy,
    skillsPlan,
    skillsModalOpen,
    builtinNotifyBusy,
    builtinNotifyPath,
    busy,
    isValid,
    previewConfig,
    previewText,
    dirty,
    builtinNotifyEntry,
    builtinNotifyEnabled,
    filteredSettings,
  }), [
    configPath,
    exists,
    sourceText,
    baseConfig,
    formValues,
    searchText,
    commitDraft,
    notificationDraft,
    desktopDraft,
    agentDraft,
    mcpServersDraft,
    mcpServersError,
    mcpServersModalOpen,
    skillsSourcePath,
    skillsTargetPath,
    skillsBusy,
    skillsPlan,
    skillsModalOpen,
    builtinNotifyBusy,
    builtinNotifyPath,
    busy,
    isValid,
    previewConfig,
    previewText,
    dirty,
    builtinNotifyEntry,
    builtinNotifyEnabled,
    filteredSettings,
  ])

  const actions = useMemo(() => ({
    reload,
    save,
    setSearchText,
    updateFormValue,
    setMcpServersModalOpen,
    setSkillsModalOpen,
    setSkillsPlan,
    setSkillsSourcePath,
    setSkillsTargetPath,
    updateCommitDraft,
    resetCommitDraft,
    updateNotificationDraft,
    resetNotificationDraft,
    updateDesktopDraft,
    resetDesktopDraft,
    updateAgentModel,
    removeAgent,
    resetAgentDraft,
    updateMcpServersDraft,
    formatMcpServersDraft,
    resetMcpServersDraft,
    enableBuiltinNotify,
    disableBuiltinNotify,
    addCustomPlugin,
    removeCustomPlugin,
    runSkillsMigration,
    applySkillsMigration,
  }), [
    reload,
    save,
    setSearchText,
    updateFormValue,
    setMcpServersModalOpen,
    setSkillsModalOpen,
    setSkillsPlan,
    setSkillsSourcePath,
    setSkillsTargetPath,
    updateCommitDraft,
    resetCommitDraft,
    updateNotificationDraft,
    resetNotificationDraft,
    updateDesktopDraft,
    resetDesktopDraft,
    updateAgentModel,
    removeAgent,
    resetAgentDraft,
    updateMcpServersDraft,
    formatMcpServersDraft,
    resetMcpServersDraft,
    enableBuiltinNotify,
    disableBuiltinNotify,
    addCustomPlugin,
    removeCustomPlugin,
    runSkillsMigration,
    applySkillsMigration,
  ])

  return { state, actions, contextHolder }
}
