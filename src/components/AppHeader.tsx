import { Button, Layout, Typography } from 'antd'
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { useHeaderStore } from '../store/headerStore'

const { Header } = Layout
const { Title, Text } = Typography

// 为什么：将顶栏抽出为独立组件，避免 App.tsx 继续膨胀。
export default function AppHeader() {
  // 为什么：从 header store 获取数据与动作，保持职责单一。
  const state = useHeaderStore((store) => store.state)
  const actions = useHeaderStore((store) => store.actions)

  if (!state || !actions) return null

  const { configPath, exists, dirty, busy } = state

  return (
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
          onClick={actions.reload}
          loading={busy}
          className="nordic-btn nordic-btn--icon"
        />
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={actions.save}
          disabled={busy || !dirty}
          className="nordic-btn nordic-btn--primary"
        >
          Save
        </Button>
      </div>
    </Header>
  )
}
