use serde::Serialize;
use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

mod paths;
mod plugins;
mod skills;

use paths::{config_path, expand_tilde};
use plugins::{builtin_plugin_content, builtin_plugin_dest_path};
use skills::{apply_skills_migration_core, build_skills_plan};

#[derive(Serialize)]
pub struct ReadConfigResponse {
  pub path: String,
  pub exists: bool,
  pub content: String,
}

#[derive(Serialize)]
pub struct WriteConfigResponse {
  pub path: String,
  pub backup_path: Option<String>,
}

#[derive(Serialize)]
pub struct SkillsMigrationItem {
  pub name: String,
  pub source: String,
  pub target: String,
  pub exists: bool,
  pub is_dir: bool,
}

#[derive(Serialize)]
pub struct SkillsMigrationPlan {
  pub items: Vec<SkillsMigrationItem>,
  pub conflict_count: usize,
}

#[derive(Serialize)]
pub struct SkillsMigrationResult {
  pub copied: usize,
  pub skipped: usize,
  pub replaced: usize,
}

#[derive(Serialize)]
pub struct InstallBuiltinPluginResponse {
  pub id: String,
  // 为什么：返回实际路径，让前端直接写入配置，避免 builtin 解析失败。
  pub path: String,
  pub wrote: bool,
}

#[tauri::command]
pub fn get_config_path() -> Result<String, String> {
  Ok(config_path()?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_config() -> Result<ReadConfigResponse, String> {
  let path = config_path()?;
  let path_str = path.to_string_lossy().to_string();

  match fs::read_to_string(&path) {
    Ok(content) => Ok(ReadConfigResponse {
      path: path_str,
      exists: true,
      content,
    }),
    Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(ReadConfigResponse {
      path: path_str,
      exists: false,
      // 为什么：不存在时给一个最小模板，让 UI 可直接进入编辑/保存流程。
      content: "{\n}\n".to_string(),
    }),
    Err(err) => Err(format!("读取配置失败：{err}")),
  }
}

#[tauri::command]
pub fn write_config(content: String) -> Result<WriteConfigResponse, String> {
  let path = config_path()?;
  let dir = path
    .parent()
    .ok_or_else(|| "配置路径不合法（无法获取父目录）".to_string())?;

  // 为什么：先在后端做一次 JSON 校验，避免写入损坏配置导致 Neovate 无法启动。
  serde_json::from_str::<serde_json::Value>(&content)
    .map_err(|e| format!("配置不是合法 JSON：{e}"))?;

  fs::create_dir_all(dir).map_err(|e| format!("创建配置目录失败：{e}"))?;

  let backup_path = if path.exists() {
    let ts = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .map_err(|e| format!("获取时间戳失败：{e}"))?
      .as_secs();
    let backup = dir.join(format!("config.json.bak-{ts}"));
    fs::copy(&path, &backup).map_err(|e| format!("备份配置失败：{e}"))?;
    Some(backup.to_string_lossy().to_string())
  } else {
    None
  };

  // 为什么：尽量降低“写一半就崩”的风险，先写临时文件再替换。
  let tmp_path = dir.join("config.json.tmp");
  fs::write(&tmp_path, content).map_err(|e| format!("写入临时配置失败：{e}"))?;

  if path.exists() {
    fs::remove_file(&path).map_err(|e| format!("替换配置失败（删除旧文件失败）：{e}"))?;
  }
  fs::rename(&tmp_path, &path).map_err(|e| format!("替换配置失败（重命名失败）：{e}"))?;

  Ok(WriteConfigResponse {
    path: path.to_string_lossy().to_string(),
    backup_path,
  })
}

#[tauri::command]
pub fn install_builtin_plugin(handle: tauri::AppHandle, id: String) -> Result<InstallBuiltinPluginResponse, String> {
  let id = id.trim();
  if id.is_empty() {
    return Err("内置插件 id 不能为空".to_string());
  }

  let dest = builtin_plugin_dest_path(&handle, id)?;
  let content = builtin_plugin_content(id)?;

  if let Some(parent) = dest.parent() {
    fs::create_dir_all(parent).map_err(|e| format!("创建插件目录失败：{e}"))?;
  } else {
    return Err("插件路径不合法（无法获取父目录）".to_string());
  }

  // 为什么：默认不覆盖用户已有文件，避免覆盖用户的自定义修改。
  if dest.exists() {
    return Ok(InstallBuiltinPluginResponse {
      id: id.to_string(),
      path: dest.to_string_lossy().to_string(),
      wrote: false,
    });
  }

  fs::write(&dest, content).map_err(|e| format!("写入内置插件失败：{e}"))?;

  Ok(InstallBuiltinPluginResponse {
    id: id.to_string(),
    path: dest.to_string_lossy().to_string(),
    wrote: true,
  })
}

#[tauri::command]
pub fn plan_skills_migration(source_path: String, target_path: String) -> Result<SkillsMigrationPlan, String> {
  let source = expand_tilde(source_path.trim())?;
  let target = expand_tilde(target_path.trim())?;
  if !source.exists() {
    return Err("源目录不存在".to_string());
  }

  let items = build_skills_plan(&source, &target)?;
  let conflict_count = items.iter().filter(|item| item.exists).count();
  Ok(SkillsMigrationPlan { items, conflict_count })
}

#[tauri::command]
pub fn apply_skills_migration(
  source_path: String,
  target_path: String,
  mode: String,
) -> Result<SkillsMigrationResult, String> {
  let source = expand_tilde(source_path.trim())?;
  let target = expand_tilde(target_path.trim())?;
  if !source.exists() {
    return Err("源目录不存在".to_string());
  }
  let mode = mode.trim();
  if mode != "replace" && mode != "skip" {
    return Err("无效的迁移模式（仅支持 replace/skip）".to_string());
  }

  fs::create_dir_all(&target).map_err(|e| format!("创建目标目录失败：{e}"))?;
  let items = build_skills_plan(&source, &target)?;

  let (copied, skipped, replaced) = apply_skills_migration_core(items, mode)?;

  Ok(SkillsMigrationResult {
    copied,
    skipped,
    replaced,
  })
}
