import { Button, Modal, Typography } from 'antd'
import { useSkillsStore } from '../store/skillsStore'

const { Text } = Typography

// 为什么：技能迁移冲突弹窗独立，便于维护交互分支。
export default function SkillsConflictModal() {
  // 为什么：技能迁移状态独立读取，避免全局状态耦合。
  const state = useSkillsStore((store) => store.state)
  const actions = useSkillsStore((store) => store.actions)

  if (!state || !actions) return null

  const { skillsModalOpen, skillsPlan, skillsSourcePath, skillsTargetPath } = state

  return (
    <Modal
      title="技能迁移冲突"
      open={skillsModalOpen}
      onCancel={() => {
        actions.setSkillsModalOpen(false)
        actions.setSkillsPlan(null)
      }}
      footer={[
        <Button
          key="cancel"
          onClick={() => {
            actions.setSkillsModalOpen(false)
            actions.setSkillsPlan(null)
          }}
        >
          取消
        </Button>,
        <Button
          key="skip"
          onClick={() => {
            actions.setSkillsModalOpen(false)
            void actions.applySkillsMigration('skip')
            actions.setSkillsPlan(null)
          }}
        >
          跳过冲突并继续
        </Button>,
        <Button
          key="replace"
          type="primary"
          onClick={() => {
            actions.setSkillsModalOpen(false)
            void actions.applySkillsMigration('replace')
            actions.setSkillsPlan(null)
          }}
        >
          替换冲突并继续
        </Button>,
      ]}
    >
      <Text style={{ fontSize: 13 }}>
        检测到 {skillsPlan?.conflictCount ?? 0} 项同名目录或文件已存在，是否进行替换？
      </Text>
      <div style={{ marginTop: 8 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          源目录：{skillsSourcePath || '未填写'}
        </Text>
      </div>
      <div style={{ marginTop: 4 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          目标目录：{skillsTargetPath || '未填写'}
        </Text>
      </div>
    </Modal>
  )
}
