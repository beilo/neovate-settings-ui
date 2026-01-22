import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { invoke } from '@tauri-apps/api/core'
import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'

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

const SETTINGS: SettingDef[] = [
  {
    key: 'approvalMode',
    kind: 'enum',
    title: 'approvalMode',
    description: '审批模式。',
    defaultHint: '"default"',
    options: ['autoEdit', 'yolo', 'default'],
  },
  {
    key: 'autoCompact',
    kind: 'boolean',
    title: 'autoCompact',
    description: '是否启用自动压缩；关闭后对话历史会累积，可能超出上下文限制。',
    defaultHint: 'true',
  },
  {
    key: 'autoUpdate',
    kind: 'boolean',
    title: 'autoUpdate',
    description: '是否启用自动更新。',
    defaultHint: 'true',
  },
  {
    key: 'browser',
    kind: 'boolean',
    title: 'browser',
    description: '是否启用浏览器 MCP 集成。',
    defaultHint: 'false',
  },
  {
    key: 'commit',
    kind: 'complex',
    title: 'commit',
    description: '提交信息生成配置（language / systemPrompt / model）。',
    defaultHint: '{ language: "en" }',
  },
  {
    key: 'desktop',
    kind: 'complex',
    title: 'desktop',
    description: '桌面应用配置（仅全局可用）。',
    defaultHint: '{ theme: "light", sendMessageWith: "enter" }',
  },
  {
    key: 'extensions',
    kind: 'complex',
    title: 'extensions',
    description: '第三方自定义 agent 扩展配置，允许任意嵌套。',
    defaultHint: '{}',
  },
  {
    key: 'httpProxy',
    kind: 'string',
    title: 'httpProxy',
    description: '网络请求使用的 HTTP 代理地址。',
    defaultHint: 'null',
  },
  {
    key: 'language',
    kind: 'string',
    title: 'language',
    description: '界面与回复语言。',
    defaultHint: '"English"',
  },
  {
    key: 'mcpServers',
    kind: 'complex',
    title: 'mcpServers',
    description: 'MCP 服务器配置（stdio / sse / http）。',
    defaultHint: '{}',
  },
  {
    key: 'model',
    kind: 'string',
    title: 'model',
    description: '默认模型（provider_id/model_id）。',
    defaultHint: 'null',
  },
  {
    key: 'outputFormat',
    kind: 'enum',
    title: 'outputFormat',
    description: 'CLI 输出格式。',
    defaultHint: '"text"',
    options: ['text', 'stream-json', 'json'],
  },
  {
    key: 'outputStyle',
    kind: 'string',
    title: 'outputStyle',
    description: '输出风格。',
    defaultHint: '"Default"',
  },
  {
    key: 'planModel',
    kind: 'string',
    title: 'planModel',
    description: '规划模型（provider_id/model_id）。',
    defaultHint: '与 model 相同',
  },
  {
    key: 'plugins',
    kind: 'complex',
    title: 'plugins',
    description: '启用的插件列表。',
    defaultHint: '[]',
  },
  {
    key: 'provider',
    kind: 'complex',
    title: 'provider',
    description: '自定义 provider 配置，用于覆盖默认 provider 设置。',
    defaultHint: '{}',
  },
  {
    key: 'quiet',
    kind: 'boolean',
    title: 'quiet',
    description: '是否抑制非必要输出。',
    defaultHint: 'false',
  },
  {
    key: 'smallModel',
    kind: 'string',
    title: 'smallModel',
    description: '轻量任务使用的小模型（provider_id/model_id）。',
    defaultHint: '与 model 相同',
  },
  {
    key: 'systemPrompt',
    kind: 'string',
    title: 'systemPrompt',
    description: '系统提示词。',
    defaultHint: 'null',
  },
  {
    key: 'temperature',
    kind: 'number',
    title: 'temperature',
    description: '模型温度参数。',
    defaultHint: 'null',
  },
  {
    key: 'todo',
    kind: 'boolean',
    title: 'todo',
    description: '是否启用 todo 功能。',
    defaultHint: 'true',
  },
  {
    key: 'tools',
    kind: 'complex',
    title: 'tools',
    description: '工具开关配置（将某个工具设为 false 可禁用）。',
    defaultHint: '{}',
  },
  {
    key: 'visionModel',
    kind: 'string',
    title: 'visionModel',
    description: '图像相关任务使用的视觉模型（provider_id/model_id）。',
    defaultHint: '与 model 相同',
  },
]

function kindLabel(kind: SettingKind): string {
  switch (kind) {
    case 'enum':
      return '枚举'
    case 'boolean':
      return '布尔'
    case 'string':
      return '字符串'
    case 'number':
      return '数字'
    case 'complex':
      return '复杂对象'
    default:
      return '未知'
  }
}

type ReadConfigResponse = {
  path: string
  exists: boolean
  content: string
}

type WriteConfigResponse = {
  path: string
  backup_path?: string | null
}

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
    // 为什么：只接受类型匹配的值，避免脏数据污染表单。
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
      // 为什么：空值代表“使用默认”，需要从配置中删除该字段。
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
    // 为什么：复杂配置只读，展示时截断避免撑爆布局。
    return raw.length > 140 ? `${raw.slice(0, 140)}…` : raw
  } catch {
    return '（无法展示当前值）'
  }
}

export default function App() {
  const [configPath, setConfigPath] = useState<string>('')
  const [exists, setExists] = useState<boolean>(true)
  const [sourceText, setSourceText] = useState<string>('{\n}\n')
  const [baseConfig, setBaseConfig] = useState<Record<string, unknown>>({})
  const [formValues, setFormValues] = useState<FormState>({})
  const [searchText, setSearchText] = useState<string>('')
  const loadedTextRef = useRef<string>('{\n}\n')

  const [busy, setBusy] = useState<boolean>(false)
  const [lastSaveInfo, setLastSaveInfo] = useState<string>('')
  const [error, setError] = useState<string>('')

  const parse = useMemo(() => safeJsonParse(sourceText), [sourceText])
  const isValid = parse.ok
  const previewConfig = useMemo(() => applyFormValues(baseConfig, formValues), [baseConfig, formValues])
  const previewText = useMemo(() => stringifyConfig(previewConfig), [previewConfig])
  const dirty = previewText !== loadedTextRef.current
  const filteredSettings = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    // 为什么：配置项太多，用轻量过滤减少翻找成本。
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
    // 为什么：结构固定来自文档，这里只做“值填充”。
    setSourceText(content)
    setBaseConfig(base)
    setFormValues(picked)
    loadedTextRef.current = stringifyConfig(applyFormValues(base, picked))
  }, [])

  const reload = useCallback(async () => {
    setBusy(true)
    setError('')
    setLastSaveInfo('')
    try {
      const res = (await invoke('read_config')) as ReadConfigResponse
      setConfigPath(res.path)
      setExists(res.exists)
      syncFromContent(res.content)
    } catch (e) {
      setError(`加载配置失败：${String(e)}`)
    } finally {
      setBusy(false)
    }
  }, [syncFromContent])

  async function save() {
    setBusy(true)
    setError('')
    setLastSaveInfo('')
    try {
      const res = (await invoke('write_config', { content: previewText })) as WriteConfigResponse
      syncFromContent(previewText)
      setExists(true)
      const backupPath = res.backup_path ? String(res.backup_path) : ''
      setLastSaveInfo(backupPath ? `已保存。已备份到：${backupPath}` : '已保存。')
    } catch (e) {
      setError(`保存配置失败：${String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    // 为什么：启动即加载，减少“打开后还要点一次”的摩擦。
    void reload()
  }, [reload])

  const statusClass = isValid ? 'statusOk' : 'statusBad'

  return (
    <div className="app">
      <div className="topbar">
        <div className="title">Neovate 设置</div>
        <div className="meta" title={configPath}>
          <span className={`statusDot ${statusClass}`} />
          {configPath || '~/.neovate/config.json'} · {exists ? '已存在' : '不存在（将新建）'} ·{' '}
          {dirty ? '已修改' : '未修改'}
        </div>
        <button className="btn btnSecondary" onClick={reload} disabled={busy}>
          重新加载
        </button>
        <button className="btn" onClick={save} disabled={busy || !dirty}>
          保存
        </button>
      </div>

      <div className="main">
        <div className="pane">
          <div className="paneHeader">文档配置（可视化编辑）</div>
          <div className="paneBody">
            {!isValid && (
              <div className="error">
                JSON 解析失败：{parse.ok ? '' : parse.message}
                <div style={{ height: 6 }} />
                当前配置无法解析，会以表单内容重建配置后保存。
              </div>
            )}

            <div className="settingsSearch">
              <input
                className="input settingsSearchInput"
                placeholder="搜索配置项（名称 / 描述 / 默认值）"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value)
                }}
              />
              {searchText.trim() !== '' && (
                <button
                  type="button"
                  className="searchClear"
                  onClick={() => {
                    setSearchText('')
                  }}
                >
                  清除
                </button>
              )}
              <div className="settingsSearchMeta">
                {searchText.trim() !== ''
                  ? `匹配 ${filteredSettings.length} / ${SETTINGS.length}`
                  : `共 ${SETTINGS.length} 项`}
              </div>
            </div>

            {filteredSettings.length === 0 && (
              <div className="settingsEmpty">没有匹配的配置项。</div>
            )}

            <div className="settingsForm">
              {filteredSettings.map((def) => {
                const value = formValues[def.key]
                const isComplex = def.kind === 'complex'
                return (
                  <div key={def.key} className={`settingCard ${isComplex ? 'settingCardDisabled' : ''}`}>
                    <div className="settingHeader">
                      <div className="settingKey">{def.title}</div>
                      <div className="settingType">{kindLabel(def.kind)}</div>
                    </div>
                    <div className="settingDesc">{def.description}</div>
                    <div className="settingControl">
                      {def.kind === 'boolean' && (
                        <select
                          className="select"
                          value={value === undefined ? '' : (value as boolean) ? 'true' : 'false'}
                          onChange={(e) => {
                            const raw = e.target.value
                            setFormValues((prev) => ({
                              ...prev,
                              [def.key]: raw === '' ? undefined : raw === 'true',
                            }))
                          }}
                        >
                          <option value="">默认（{def.defaultHint}）</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      )}

                      {def.kind === 'enum' && (
                        <select
                          className="select"
                          value={value === undefined ? '' : String(value)}
                          onChange={(e) => {
                            const raw = e.target.value
                            setFormValues((prev) => ({ ...prev, [def.key]: raw === '' ? undefined : raw }))
                          }}
                        >
                          <option value="">默认（{def.defaultHint}）</option>
                          {(def.options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {def.kind === 'string' && (
                        <input
                          className="input"
                          value={value === undefined ? '' : String(value)}
                          placeholder={`默认：${def.defaultHint}`}
                          onChange={(e) => {
                            const raw = e.target.value
                            setFormValues((prev) => ({ ...prev, [def.key]: raw.trim() === '' ? undefined : raw }))
                          }}
                        />
                      )}

                      {def.kind === 'number' && (
                        <input
                          className="input"
                          inputMode="decimal"
                          value={value === undefined ? '' : String(value)}
                          placeholder={`默认：${def.defaultHint}`}
                          onChange={(e) => {
                            const raw = e.target.value.trim()
                            if (raw === '') {
                              setFormValues((prev) => ({ ...prev, [def.key]: undefined }))
                              return
                            }
                            const n = Number(raw)
                            if (!Number.isNaN(n)) {
                              setFormValues((prev) => ({ ...prev, [def.key]: n }))
                            }
                          }}
                        />
                      )}

                      {def.kind === 'complex' && (
                        <div className="readonlyValue">{formatComplexValue(baseConfig[def.key])}</div>
                      )}
                    </div>
                    <div className="settingMeta">默认：{def.defaultHint}</div>
                    {def.kind === 'complex' && (
                      <div className="settingNotice">复杂配置暂不支持编辑，保存时会保留当前值。</div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ height: 14 }} />
            <div className="hint">
              右侧 JSON 为只读预览，内容来自表单。保存时会先在同目录自动备份一份（`config.json.bak-时间戳`），再写入新内容。
            </div>
          </div>
        </div>

        <div className="divider" />

        <div className="pane">
          <div className="paneHeader">JSON（预览，只读）</div>
          <div className="paneBodyCode">
            <CodeMirror
              value={previewText}
              height="100%"
              theme={oneDark}
              extensions={[json()]}
              editable={false}
              readOnly
              style={{ flex: 1, height: '100%' }}
            />
          </div>
        </div>
      </div>

      {(error || lastSaveInfo) && (
        <div className="toast-container">
          {error && (
            <div
              className="toast"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}
          {lastSaveInfo && !error && (
            <div
              className="toast"
              style={{
                background: '#ecfdf5',
                border: '1px solid #bbf7d0',
                color: '#065f46',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              {lastSaveInfo}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
