import { Button, Input, Modal, Typography } from 'antd'

type Props = {
  open: boolean
  draft: string
  error: string
  onClose: () => void
  onReset: () => void
  onFormat: () => void
  onChange: (value: string) => void
}

const { Text } = Typography

// 为什么：mcpServers 弹窗独立，便于复用和维护。
export default function McpServersModal({ open, draft, error, onClose, onReset, onFormat, onChange }: Props) {
  return (
    <Modal
      title="编辑 MCP Servers"
      open={open}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="reset" onClick={onReset}>
          清空
        </Button>,
        <Button key="format" onClick={onFormat} disabled={!draft.trim() || !!error}>
          格式化
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
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
        value={draft}
        onChange={(e) => onChange(e.target.value)}
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
      {error && (
        <Text type="danger" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
          {error}
        </Text>
      )}
      {!error && draft.trim() && (
        <Text type="success" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
          ✓ JSON 格式正确
        </Text>
      )}
    </Modal>
  )
}
