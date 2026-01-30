import { create } from 'zustand'
import type { ConfigActions, ConfigState } from '../hooks/useConfigState'
import { shallowEqual } from './shallowEqual'

type McpState = Pick<ConfigState, 'mcpServersDraft' | 'mcpServersError' | 'mcpServersModalOpen'>

type McpActions = Pick<
  ConfigActions,
  | 'setMcpServersModalOpen'
  | 'resetMcpServersDraft'
  | 'formatMcpServersDraft'
  | 'updateMcpServersDraft'
>

type McpStore = {
  state: McpState | null
  actions: McpActions | null
  setSnapshot: (state: ConfigState, actions: ConfigActions) => void
}

export const useMcpStore = create<McpStore>((set) => ({
  state: null,
  actions: null,
  // 为什么：mcp 相关状态独立存放，避免设置面板感知细节。
  setSnapshot: (state, actions) =>
    set((prev) => {
      const nextState: McpState = {
        mcpServersDraft: state.mcpServersDraft,
        mcpServersError: state.mcpServersError,
        mcpServersModalOpen: state.mcpServersModalOpen,
      }
      const nextActions: McpActions = {
        setMcpServersModalOpen: actions.setMcpServersModalOpen,
        resetMcpServersDraft: actions.resetMcpServersDraft,
        formatMcpServersDraft: actions.formatMcpServersDraft,
        updateMcpServersDraft: actions.updateMcpServersDraft,
      }
      // 为什么：避免无关状态变化导致 mcp 弹窗/草稿组件重复渲染。
      if (shallowEqual(prev.state, nextState) && shallowEqual(prev.actions, nextActions)) return prev
      return { state: nextState, actions: nextActions }
    }),
}))
