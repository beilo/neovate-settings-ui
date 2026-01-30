import { Button, Modal, Typography } from 'antd'

const { Text } = Typography

type Props = {
  open: boolean
  conflictCount: number
  sourcePath: string
  targetPath: string
  onCancel: () => void
  onSkip: () => void
  onReplace: () => void
}

// 为什么：技能迁移冲突弹窗独立，便于维护交互分支。
export default function SkillsConflictModal({
  open,
  conflictCount,
  sourcePath,
  targetPath,
  onCancel,
  onSkip,
  onReplace,
}: Props) {
  return (
    <Modal
      title="技能迁移冲突"
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="skip" onClick={onSkip}>
          跳过冲突并继续
        </Button>,
        <Button key="replace" type="primary" onClick={onReplace}>
          替换冲突并继续
        </Button>,
      ]}
    >
      <Text style={{ fontSize: 13 }}>检测到 {conflictCount} 项同名目录或文件已存在，是否进行替换？</Text>
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          源目录：{sourcePath || '未填写'}
        </Text>
      </div>
      <div style={{ marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          目标目录：{targetPath || '未填写'}
        </Text>
      </div>
    </Modal>
  )
}
