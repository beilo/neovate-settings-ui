import { Button, Card, Input, Popconfirm, Select, Switch, Tag, Typography } from 'antd'
import {
  DeleteOutlined,
  InfoCircleOutlined,
  RobotOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type {
  NotificationMode,
  DesktopDraft,
} from '../lib/configTypes'
import { BUILTIN_AGENT_TYPES, MACOS_SOUNDS } from '../lib/settingsSchema'
import { formatComplexValue, isBuiltinNotifyPluginEntry, pickStringArray, safeJsonParse, isPlainObject } from '../lib/configHelpers'
import { useSettingsStore } from '../store/settingsStore'
import { useMcpStore } from '../store/mcpStore'
import { useSkillsStore } from '../store/skillsStore'

const { Text } = Typography
const { Option } = Select

// 为什么：设置面板独立，集中处理表单与复杂设置区渲染。
export default function SettingsPanel() {
  // 为什么：按领域读取 store，降低依赖面。
  const settingsState = useSettingsStore((store) => store.state)
  const settingsActions = useSettingsStore((store) => store.actions)
  const mcpState = useMcpStore((store) => store.state)
  const mcpActions = useMcpStore((store) => store.actions)
  const skillsState = useSkillsStore((store) => store.state)
  const skillsActions = useSkillsStore((store) => store.actions)

  // 为什么：store 尚未就绪时先不渲染，避免空引用报错。
  if (!settingsState || !settingsActions || !mcpState || !mcpActions || !skillsState || !skillsActions) return null

  const {
    filteredSettings,
    searchText,
    isValid,
    formValues,
    previewConfig,
    commitDraft,
    notificationDraft,
    desktopDraft,
    agentDraft,
    builtinNotifyEnabled,
    builtinNotifyEntry,
    builtinNotifyBusy,
    builtinNotifyPath,
  } = settingsState

  const { mcpServersDraft, mcpServersError } = mcpState
  const { skillsSourcePath, skillsTargetPath, skillsBusy } = skillsState

  return (
    <div className="settings-panel">
      {/* 为什么：浮动搜索栏 sticky 定位，滚动时始终可见。 */}
      <div className="settings-search-wrapper">
        <div className="settings-container">
          <div className="settings-search">
            <SearchOutlined className="settings-search-icon" />
            <input
              type="text"
              className="settings-search-input"
              placeholder="搜索设置项..."
              value={searchText}
              onChange={(e) => settingsActions.setSearchText(e.target.value)}
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

            // 为什么：agent 使用卡片网格布局，每个 Agent 类型一张卡片，支持模型选择和自定义添加。
            if (def.kind === 'complex' && def.key === 'agent') {
              const rowBorder = isLast ? 'none' : '1px solid #f0f0f0'
              // 为什么：合并内置类型和用户自定义类型，确保所有配置都能展示。
              const allAgentTypes = Array.from(new Set([
                ...BUILTIN_AGENT_TYPES,
                ...Object.keys(agentDraft),
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
                      <Button size="small" onClick={settingsActions.resetAgentDraft}>
                        重置
                      </Button>
                    </div>
                  </div>

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
                                  onConfirm={() => settingsActions.removeAgent(agentType)}
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
                              onChange={(e) => settingsActions.updateAgentModel(agentType, e.target.value)}
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
              return (
                <div key={def.key}>
                  <div className="setting-row" style={{ borderBottom: 'none' }}>
                    <div className="setting-info">
                      <div className="setting-header">
                        <Text className="setting-key">{def.title}</Text>
                      </div>
                      <Text className="setting-desc">{def.description}</Text>
                      <div className="setting-default">Default: {def.defaultHint}</div>
                    </div>
                    <div className="setting-control" style={{ width: 240, gap: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {formatComplexValue(previewConfig.commit)} <InfoCircleOutlined />
                      </Text>
                      <Button size="small" onClick={settingsActions.resetCommitDraft}>重置</Button>
                    </div>
                  </div>

                  <div className="complex-expand" style={{ borderBottom: isLast ? 'none' : undefined }}>
                    <div className="complex-field">
                      <Text className="complex-field-label">language</Text>
                      <Input
                        className="complex-field-control"
                        style={{ textAlign: 'right' }}
                        placeholder="默认：en"
                        value={commitDraft.language ?? ''}
                        onChange={(e) => settingsActions.updateCommitDraft({ language: e.target.value })}
                        allowClear
                      />
                    </div>
                    <div className="complex-field">
                      <Text className="complex-field-label">model</Text>
                      <Input
                        className="complex-field-control"
                        style={{ textAlign: 'right' }}
                        placeholder="provider_id/model_id（留空=全局默认）"
                        value={commitDraft.model ?? ''}
                        onChange={(e) => settingsActions.updateCommitDraft({ model: e.target.value })}
                        allowClear
                      />
                    </div>
                    <div style={{ paddingTop: 8 }}>
                      <div className="complex-field">
                        <Text className="complex-field-label">systemPrompt</Text>
                        <Text type="secondary" style={{ fontSize: 11 }}>追加到默认提示后面</Text>
                      </div>
                      <Input.TextArea
                        placeholder="留空=不追加"
                        value={commitDraft.systemPrompt ?? ''}
                        onChange={(e) => settingsActions.updateCommitDraft({ systemPrompt: e.target.value })}
                        autoSize={{ minRows: 3, maxRows: 10 }}
                      />
                    </div>
                  </div>
                </div>
              )
            }

            // 为什么：mcpServers 使用弹窗编辑器，点击按钮打开 Modal。
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
                    <Button size="small" onClick={() => mcpActions.setMcpServersModalOpen(true)}>
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
                          onChange={(e) => skillsActions.setSkillsSourcePath(e.target.value)}
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
                          onChange={(e) => skillsActions.setSkillsTargetPath(e.target.value)}
                          allowClear
                        />
                      </div>

                      <div style={{ paddingTop: 10 }}>
                        <Button size="small" onClick={() => void skillsActions.runSkillsMigration()} loading={skillsBusy}>
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
              const allPlugins = pickStringArray((previewConfig as Record<string, unknown>).plugins)
              const customPlugins = allPlugins.filter((p) => !isBuiltinNotifyPluginEntry(p, builtinNotifyPath))
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
                        {allPlugins.length > 0 && (
                          <Tag color="blue" style={{ margin: 0 }}>
                            {allPlugins.length} 个插件
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
                      <Button size="small" onClick={() => void settingsActions.addCustomPlugin()}>
                        添加插件
                      </Button>
                    </div>
                  </div>

                  <div style={{ borderBottom: rowBorder, padding: '0 20px 16px 20px' }}>
                    <div style={{ paddingTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        内置插件（可选启用）：开启后会在 plugins 数组中添加 builtin:xxx 标识符。
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
                                配置值：{builtinNotifyEntry}
                              </Text>
                            </div>
                          )}
                        </div>

                        <Switch
                          checked={builtinNotifyEnabled}
                          disabled={builtinNotifyBusy}
                          onChange={(checked) => {
                            if (checked) void settingsActions.enableBuiltinNotify()
                            else settingsActions.disableBuiltinNotify()
                          }}
                        />
                      </div>
                    </Card>

                    {customPlugins.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <Text style={{ fontSize: 12, fontWeight: 500 }}>自定义插件</Text>
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {customPlugins.map((pluginPath) => (
                            <Card key={pluginPath} size="small" style={{ borderRadius: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <Text style={{ fontSize: 12, wordBreak: 'break-all' }}>{pluginPath}</Text>
                                </div>
                                <Popconfirm
                                  title="确定移除此插件？"
                                  onConfirm={() => settingsActions.removeCustomPlugin(pluginPath)}
                                  okText="移除"
                                  cancelText="取消"
                                >
                                  <Button type="text" size="small" icon={<DeleteOutlined />} danger />
                                </Popconfirm>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
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
                        <Text type="secondary" style={{ fontSize: 10, opacity: 0.7 }}>Default: {def.defaultHint}</Text>
                      </div>
                    </div>

                    <div style={{ width: 240, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>
                        {formatComplexValue(previewConfig.notification)} <InfoCircleOutlined />
                      </Text>
                      <Button size="small" onClick={settingsActions.resetNotificationDraft}>重置</Button>
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
                            settingsActions.updateNotificationDraft({ mode, webhookUrl: notificationDraft.webhookUrl, soundName: '' })
                            return
                          }
                          if (mode === 'sound') {
                            settingsActions.updateNotificationDraft({ mode, soundName: notificationDraft.soundName, webhookUrl: '' })
                            return
                          }
                          settingsActions.updateNotificationDraft({ mode, soundName: '', webhookUrl: '' })
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
                            onChange={(v) => settingsActions.updateNotificationDraft({ soundName: String(v) })}
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
                            onChange={(e) => settingsActions.updateNotificationDraft({ soundName: e.target.value })}
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
                            onChange={(e) => settingsActions.updateNotificationDraft({ webhookUrl: e.target.value })}
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
                        <Text type="secondary" style={{ fontSize: 10, opacity: 0.7 }}>Default: {def.defaultHint}</Text>
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
                      <Button size="small" onClick={settingsActions.resetDesktopDraft}>重置</Button>
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
                        onChange={(v) => settingsActions.updateDesktopDraft({ theme: v === 'default' ? undefined : (v as DesktopDraft['theme']) })}
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
                          settingsActions.updateDesktopDraft({ sendMessageWith: v === 'default' ? undefined : (v as DesktopDraft['sendMessageWith']) })
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
                        onChange={(e) => settingsActions.updateDesktopDraft({ terminalFont: e.target.value === '' ? undefined : e.target.value })}
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
                            settingsActions.updateDesktopDraft({ terminalFontSize: undefined })
                            return
                          }
                          const num = Number(raw)
                          if (!Number.isNaN(num)) settingsActions.updateDesktopDraft({ terminalFontSize: num })
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
                  animationDelay: `${index * 0.02}s`,
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
                  {def.kind === 'boolean' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Switch
                        checked={value === true}
                        onChange={(checked) => settingsActions.updateFormValue(def.key, checked)}
                      />
                      {value === undefined && <Tag color="default" style={{ margin: 0 }}>Default</Tag>}
                    </div>
                  )}

                  {def.kind === 'enum' && (
                    <Select
                      value={value === undefined ? 'default' : String(value)}
                      style={{ width: 140 }}
                      onChange={(v) => {
                        settingsActions.updateFormValue(def.key, v === 'default' ? undefined : v)
                      }}
                    >
                      <Option value="default">Default</Option>
                      {def.options?.map((opt) => (
                        <Option key={opt} value={opt}>
                          {opt}
                        </Option>
                      ))}
                    </Select>
                  )}

                  {def.kind === 'number' && (
                    <Input
                      style={{ textAlign: 'right' }}
                      placeholder="Default"
                      value={value === undefined ? '' : String(value)}
                      onChange={(e) => {
                        const raw = e.target.value
                        if (raw.trim() === '') settingsActions.updateFormValue(def.key, undefined)
                        else if (!Number.isNaN(Number(raw))) settingsActions.updateFormValue(def.key, Number(raw))
                      }}
                    />
                  )}

                  {def.kind === 'string' && def.key === 'systemPrompt' && (
                    <Input.TextArea
                      placeholder="Default"
                      value={value === undefined ? '' : String(value)}
                      onChange={(e) => {
                        const raw = e.target.value
                        settingsActions.updateFormValue(def.key, raw === '' ? undefined : raw)
                      }}
                      autoSize={{ minRows: 3, maxRows: 10 }}
                    />
                  )}

                  {def.kind === 'string' && def.key !== 'systemPrompt' && (
                    <Input
                      style={{ textAlign: 'right' }}
                      placeholder="Default"
                      value={value === undefined ? '' : String(value)}
                      onChange={(e) => {
                        const raw = e.target.value
                        settingsActions.updateFormValue(def.key, raw === '' ? undefined : raw)
                      }}
                    />
                  )}

                  {def.kind === 'complex' && def.key !== 'commit' && (
                    <Text type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>
                      {formatComplexValue((previewConfig as Record<string, unknown>)[def.key])} <InfoCircleOutlined />
                    </Text>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="settings-footer">Neovate Configuration</div>
      </div>
    </div>
  )
}
