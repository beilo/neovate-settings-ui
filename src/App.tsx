import { useLayoutEffect } from 'react'
import { ConfigProvider, Layout } from 'antd'
import AppHeader from './components/AppHeader'
import JsonPreviewPanel from './components/JsonPreviewPanel'
import McpServersModal from './components/McpServersModal'
import SettingsPanel from './components/SettingsPanel'
import SkillsConflictModal from './components/SkillsConflictModal'
import { useConfigState } from './hooks/useConfigState'
import { useResizablePanel } from './hooks/useResizablePanel'
import { useHeaderStore } from './store/headerStore'
import { useSettingsStore } from './store/settingsStore'
import { useMcpStore } from './store/mcpStore'
import { useSkillsStore } from './store/skillsStore'
import { usePreviewStore } from './store/previewStore'
import './App.css'

const { Content } = Layout

export default function App() {
  // 为什么：状态逻辑已收敛到 hook，App 只负责布局拼装。
  const { state, actions, contextHolder } = useConfigState()
  const { width: rightPanelWidth, onMouseDown: handleDividerMouseDown } = useResizablePanel(400)
  const setHeaderSnapshot = useHeaderStore((store) => store.setSnapshot)
  const setSettingsSnapshot = useSettingsStore((store) => store.setSnapshot)
  const setMcpSnapshot = useMcpStore((store) => store.setSnapshot)
  const setSkillsSnapshot = useSkillsStore((store) => store.setSnapshot)
  const setPreviewSnapshot = usePreviewStore((store) => store.setSnapshot)

  useLayoutEffect(() => {
    // 为什么：按领域拆分 store，同步各自需要的 state/actions。
    setHeaderSnapshot(state, actions)
    setSettingsSnapshot(state, actions)
    setMcpSnapshot(state, actions)
    setSkillsSnapshot(state, actions)
    setPreviewSnapshot(state)
  }, [
    state,
    actions,
    setHeaderSnapshot,
    setSettingsSnapshot,
    setMcpSnapshot,
    setSkillsSnapshot,
    setPreviewSnapshot,
  ])

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2D7A8C',
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
          },
        },
      }}
    >
      {contextHolder}
      <Layout className="app-layout">
        <AppHeader />

        <Content className="app-content">
          <SettingsPanel />

          <div className="resizer-divider" onMouseDown={handleDividerMouseDown} />

          <JsonPreviewPanel width={rightPanelWidth} />
        </Content>
      </Layout>

      <McpServersModal />

      <SkillsConflictModal />
    </ConfigProvider>
  )
}
