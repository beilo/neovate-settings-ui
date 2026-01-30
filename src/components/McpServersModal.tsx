import { Button, Input, Modal, Typography } from 'antd'
import { useMcpStore } from '../store/mcpStore'

const { Text } = Typography

// 为什么：mcpServers 弹窗独立，便于复用和维护。
export default function McpServersModal() {
  // 为什么：mcp 相关状态独立读取，避免非必要重渲染。
  const state = useMcpStore((store) => store.state)
  const actions = useMcpStore((store) => store.actions)

  if (!state || !actions) return null

  const { mcpServersModalOpen, mcpServersDraft, mcpServersError } = state

  return (
    <Modal
      title="编辑 MCP Servers"
      open={mcpServersModalOpen}
      onCancel={() => actions.setMcpServersModalOpen(false)}
      width={600}
      footer={[
        <Button key="reset" onClick={actions.resetMcpServersDraft}>
          清空
        </Button>,
        <Button
          key="format"
          onClick={actions.formatMcpServersDraft}
          disabled={!mcpServersDraft.trim() || !!mcpServersError}
        >
          格式化
        </Button>,
        <Button key="close" type="primary" onClick={() => actions.setMcpServersModalOpen(false)}>
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
        onChange={(e) => actions.updateMcpServersDraft(e.target.value)}
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
  )
}
