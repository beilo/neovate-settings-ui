import { create } from 'zustand'
import type { ConfigActions, ConfigState } from '../hooks/useConfigState'
import { shallowEqual } from './shallowEqual'

type HeaderState = Pick<ConfigState, 'configPath' | 'exists' | 'dirty' | 'busy'>

type HeaderActions = Pick<ConfigActions, 'reload' | 'save'>

type HeaderStore = {
  state: HeaderState | null
  actions: HeaderActions | null
  setSnapshot: (state: ConfigState, actions: ConfigActions) => void
}

export const useHeaderStore = create<HeaderStore>((set) => ({
  state: null,
  actions: null,
  // 为什么：按领域拆分 header 数据，减少组件无关依赖。
  setSnapshot: (state, actions) =>
    set((prev) => {
      const nextState: HeaderState = {
        configPath: state.configPath,
        exists: state.exists,
        dirty: state.dirty,
        busy: state.busy,
      }
      const nextActions: HeaderActions = {
        reload: actions.reload,
        save: actions.save,
      }
      // 为什么：useConfigState 任意字段变化都会触发 setSnapshot；这里用浅比较避免无关重渲染。
      if (shallowEqual(prev.state, nextState) && shallowEqual(prev.actions, nextActions)) return prev
      return { state: nextState, actions: nextActions }
    }),
}))
