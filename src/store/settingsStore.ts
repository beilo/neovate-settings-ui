import { create } from 'zustand'
import type { ConfigActions, ConfigState } from '../hooks/useConfigState'
import { shallowEqual } from './shallowEqual'

type SettingsState = Pick<
  ConfigState,
  | 'filteredSettings'
  | 'searchText'
  | 'isValid'
  | 'formValues'
  | 'previewConfig'
  | 'commitDraft'
  | 'notificationDraft'
  | 'desktopDraft'
  | 'agentDraft'
  | 'builtinNotifyEnabled'
  | 'builtinNotifyEntry'
  | 'builtinNotifyBusy'
  | 'builtinNotifyPath'
>

type SettingsActions = Pick<
  ConfigActions,
  | 'setSearchText'
  | 'updateFormValue'
  | 'updateCommitDraft'
  | 'resetCommitDraft'
  | 'updateNotificationDraft'
  | 'resetNotificationDraft'
  | 'updateDesktopDraft'
  | 'resetDesktopDraft'
  | 'updateAgentModel'
  | 'removeAgent'
  | 'resetAgentDraft'
  | 'enableBuiltinNotify'
  | 'disableBuiltinNotify'
  | 'addCustomPlugin'
  | 'removeCustomPlugin'
>

type SettingsStore = {
  state: SettingsState | null
  actions: SettingsActions | null
  setSnapshot: (state: ConfigState, actions: ConfigActions) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  state: null,
  actions: null,
  // 为什么：仅保留设置面板需要的字段，避免“大而全” store。
  setSnapshot: (state, actions) =>
    set((prev) => {
      const nextState: SettingsState = {
        filteredSettings: state.filteredSettings,
        searchText: state.searchText,
        isValid: state.isValid,
        formValues: state.formValues,
        previewConfig: state.previewConfig,
        commitDraft: state.commitDraft,
        notificationDraft: state.notificationDraft,
        desktopDraft: state.desktopDraft,
        agentDraft: state.agentDraft,
        builtinNotifyEnabled: state.builtinNotifyEnabled,
        builtinNotifyEntry: state.builtinNotifyEntry,
        builtinNotifyBusy: state.builtinNotifyBusy,
        builtinNotifyPath: state.builtinNotifyPath,
      }
      const nextActions: SettingsActions = {
        setSearchText: actions.setSearchText,
        updateFormValue: actions.updateFormValue,
        updateCommitDraft: actions.updateCommitDraft,
        resetCommitDraft: actions.resetCommitDraft,
        updateNotificationDraft: actions.updateNotificationDraft,
        resetNotificationDraft: actions.resetNotificationDraft,
        updateDesktopDraft: actions.updateDesktopDraft,
        resetDesktopDraft: actions.resetDesktopDraft,
        updateAgentModel: actions.updateAgentModel,
        removeAgent: actions.removeAgent,
        resetAgentDraft: actions.resetAgentDraft,
        enableBuiltinNotify: actions.enableBuiltinNotify,
        disableBuiltinNotify: actions.disableBuiltinNotify,
        addCustomPlugin: actions.addCustomPlugin,
        removeCustomPlugin: actions.removeCustomPlugin,
      }
      // 为什么：避免 searchText 等变化导致 set() 重复触发；相同快照直接跳过。
      if (shallowEqual(prev.state, nextState) && shallowEqual(prev.actions, nextActions)) return prev
      return { state: nextState, actions: nextActions }
    }),
}))
