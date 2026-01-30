# Changelog

## [0.1.0] - 2025-01-30

### Added
- Modularized the settings UI into dedicated components and hooks (AppHeader, SettingsPanel, JsonPreviewPanel, modal dialogs).
- Added built-in notify plugin installation/enablement flow with UI wiring and backend command support.
- Added skills migration UI flow (plan/apply) with supporting backend commands.

### Changed
- Split the Tauri config backend into smaller modules (paths/plugins/skills) while keeping command handlers under config.
- Centralized configuration schema, helpers, and types to reduce UI logic duplication.
- Introduced domain-specific Zustand stores (header/settings/mcp/skills/preview) to reduce prop drilling.
