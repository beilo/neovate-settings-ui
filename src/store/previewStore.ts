import { create } from 'zustand'
import type { ConfigState } from '../hooks/useConfigState'
import { shallowEqual } from './shallowEqual'

type PreviewState = Pick<ConfigState, 'previewText'>

type PreviewStore = {
  state: PreviewState | null
  setSnapshot: (state: ConfigState) => void
}

export const usePreviewStore = create<PreviewStore>((set) => ({
  state: null,
  // 为什么：预览面板只依赖 previewText，独立 store 避免无关更新。
  setSnapshot: (state) =>
    set((prev) => {
      const nextState: PreviewState = { previewText: state.previewText }
      // 为什么：避免 settings 编辑导致预览 store 重复 set()（previewText 不变时无需更新）。
      if (shallowEqual(prev.state, nextState)) return prev
      return { state: nextState }
    }),
}))
