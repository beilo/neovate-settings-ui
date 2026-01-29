#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    // 为什么：先把“读/写 ~/.neovate/config.json”做成最小闭环，UI 只管调用命令。
    .invoke_handler(tauri::generate_handler![
      config::get_config_path,
      config::read_config,
      config::write_config,
      config::install_builtin_plugin,
      config::plan_skills_migration,
      config::apply_skills_migration
    ])
    .run(tauri::generate_context!())
    .expect("运行 Tauri 应用失败");
}

mod config;
