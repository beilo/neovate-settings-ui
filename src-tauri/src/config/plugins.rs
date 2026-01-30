use std::path::PathBuf;

use tauri::{path::BaseDirectory, Manager};

// 为什么：将内置插件代码以静态字符串打包进应用，避免依赖外部文件存在。
// 为什么：模块下移一层目录，需要上探两级找到内置插件文件。
const BUILTIN_NOTIFY_PLUGIN_JS: &str = include_str!("../../builtin-plugins/notify.js");

// 为什么：先只内置 notify，保持最小实现；未来新增内置插件只需要扩展 match。
pub fn builtin_plugin_dest_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
  match id {
    // 为什么：将内置插件写入应用本地数据目录，避免依赖 HOME 路径。
    "notify" => app
      .path()
      .resolve("plugins/notify.js", BaseDirectory::AppLocalData)
      .map_err(|e| format!("解析应用本地数据目录失败：{e}")),
    _ => Err(format!("未知内置插件 id：{id}")),
  }
}

// 为什么：用函数统一管理内置插件内容，避免散落多处写 include_str。
pub fn builtin_plugin_content(id: &str) -> Result<&'static str, String> {
  match id {
    "notify" => Ok(BUILTIN_NOTIFY_PLUGIN_JS),
    _ => Err(format!("未知内置插件 id：{id}")),
  }
}
