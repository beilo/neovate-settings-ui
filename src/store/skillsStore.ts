import { create } from 'zustand'
import type { ConfigActions, ConfigState } from '../hooks/useConfigState'
import { shallowEqual } from './shallowEqual'

type SkillsState = Pick<
  ConfigState,
  | 'skillsSourcePath'
  | 'skillsTargetPath'
  | 'skillsBusy'
  | 'skillsPlan'
  | 'skillsModalOpen'
>

type SkillsActions = Pick<
  ConfigActions,
  | 'setSkillsSourcePath'
  | 'setSkillsTargetPath'
  | 'runSkillsMigration'
  | 'setSkillsPlan'
  | 'setSkillsModalOpen'
  | 'applySkillsMigration'
>

type SkillsStore = {
  state: SkillsState | null
  actions: SkillsActions | null
  setSnapshot: (state: ConfigState, actions: ConfigActions) => void
}

export const useSkillsStore = create<SkillsStore>((set) => ({
  state: null,
  actions: null,
  // 为什么：技能迁移流程独立存放，减少跨模块耦合。
  setSnapshot: (state, actions) =>
    set((prev) => {
      const nextState: SkillsState = {
        skillsSourcePath: state.skillsSourcePath,
        skillsTargetPath: state.skillsTargetPath,
        skillsBusy: state.skillsBusy,
        skillsPlan: state.skillsPlan,
        skillsModalOpen: state.skillsModalOpen,
      }
      const nextActions: SkillsActions = {
        setSkillsSourcePath: actions.setSkillsSourcePath,
        setSkillsTargetPath: actions.setSkillsTargetPath,
        runSkillsMigration: actions.runSkillsMigration,
        setSkillsPlan: actions.setSkillsPlan,
        setSkillsModalOpen: actions.setSkillsModalOpen,
        applySkillsMigration: actions.applySkillsMigration,
      }
      // 为什么：避免 settings 的编辑导致 skills UI 无关重渲染。
      if (shallowEqual(prev.state, nextState) && shallowEqual(prev.actions, nextActions)) return prev
      return { state: nextState, actions: nextActions }
    }),
}))
