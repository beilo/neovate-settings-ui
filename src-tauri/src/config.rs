use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

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

fn home_dir() -> Result<PathBuf, String> {
  // 为什么：不引入额外依赖（dirs 等），用最朴素的环境变量拿到 Home，够用且可控。
  if let Ok(home) = std::env::var("HOME") {
    if !home.trim().is_empty() {
      return Ok(PathBuf::from(home));
    }
  }
  if let Ok(home) = std::env::var("USERPROFILE") {
    if !home.trim().is_empty() {
      return Ok(PathBuf::from(home));
    }
  }
  Err("无法定位用户主目录（缺少 HOME/USERPROFILE 环境变量）".to_string())
}

fn expand_tilde(path: &str) -> Result<PathBuf, String> {
  // 为什么：允许用户输入 ~ 作为主目录缩写，提升通用性与易用性。
  if let Some(stripped) = path.strip_prefix("~/").or_else(|| path.strip_prefix("~\\")) {
    return Ok(home_dir()?.join(stripped));
  }
  if path.trim() == "~" {
    return Ok(home_dir()?);
  }
  Ok(PathBuf::from(path))
}

pub fn config_path() -> Result<PathBuf, String> {
  Ok(home_dir()?.join(".neovate").join("config.json"))
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

fn copy_dir_recursive(source: &PathBuf, target: &PathBuf) -> Result<(), String> {
  // 为什么：这里不引入额外依赖，递归复制足够可控。
  fs::create_dir_all(target).map_err(|e| format!("创建目录失败：{e}"))?;
  for entry in fs::read_dir(source).map_err(|e| format!("读取目录失败：{e}"))? {
    let entry = entry.map_err(|e| format!("读取目录项失败：{e}"))?;
    let src_path = entry.path();
    let dst_path = target.join(entry.file_name());
    let meta = entry.metadata().map_err(|e| format!("读取元信息失败：{e}"))?;
    if meta.is_dir() {
      copy_dir_recursive(&src_path, &dst_path)?;
    } else {
      if let Some(parent) = dst_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败：{e}"))?;
      }
      fs::copy(&src_path, &dst_path).map_err(|e| format!("复制文件失败：{e}"))?;
    }
  }
  Ok(())
}

fn remove_path(path: &PathBuf) -> Result<(), String> {
  // 为什么：统一处理文件/目录删除，便于替换逻辑复用。
  if !path.exists() {
    return Ok(());
  }
  let meta = fs::metadata(path).map_err(|e| format!("读取元信息失败：{e}"))?;
  if meta.is_dir() {
    fs::remove_dir_all(path).map_err(|e| format!("删除目录失败：{e}"))?;
  } else {
    fs::remove_file(path).map_err(|e| format!("删除文件失败：{e}"))?;
  }
  Ok(())
}

fn build_skills_plan(source: &PathBuf, target: &PathBuf) -> Result<Vec<SkillsMigrationItem>, String> {
  if !source.is_dir() {
    return Err("源路径不是目录".to_string());
  }

  let mut items = Vec::new();
  let direct_skill = source.join("SKILL.md").is_file();

  if direct_skill {
    // 为什么：当源目录本身包含 SKILL.md 时，按单个技能目录处理。
    let name = source
      .file_name()
      .ok_or_else(|| "无法获取源目录名称".to_string())?
      .to_string_lossy()
      .to_string();
    let target_path = target.join(&name);
    items.push(SkillsMigrationItem {
      name,
      source: source.to_string_lossy().to_string(),
      target: target_path.to_string_lossy().to_string(),
      exists: target_path.exists(),
      is_dir: true,
    });
    return Ok(items);
  }

  for entry in fs::read_dir(source).map_err(|e| format!("读取源目录失败：{e}"))? {
    let entry = entry.map_err(|e| format!("读取目录项失败：{e}"))?;
    let name = entry
      .file_name()
      .to_string_lossy()
      .to_string();
    if name.starts_with('.') {
      // 为什么：忽略 .DS_Store 等系统隐藏文件，避免误报冲突与计数偏差。
      continue;
    }
    let src_path = entry.path();
    let target_path = target.join(&name);
    let meta = entry.metadata().map_err(|e| format!("读取元信息失败：{e}"))?;
    items.push(SkillsMigrationItem {
      name,
      source: src_path.to_string_lossy().to_string(),
      target: target_path.to_string_lossy().to_string(),
      exists: target_path.exists(),
      is_dir: meta.is_dir(),
    });
  }
  Ok(items)
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
  let mut copied = 0;
  let mut skipped = 0;
  let mut replaced = 0;

  for item in items {
    let src_path = PathBuf::from(&item.source);
    let dst_path = PathBuf::from(&item.target);
    if item.exists {
      if mode == "skip" {
        skipped += 1;
        continue;
      }
      remove_path(&dst_path)?;
      replaced += 1;
    } else {
      copied += 1;
    }

    if item.is_dir {
      copy_dir_recursive(&src_path, &dst_path)?;
    } else {
      if let Some(parent) = dst_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败：{e}"))?;
      }
      fs::copy(&src_path, &dst_path).map_err(|e| format!("复制文件失败：{e}"))?;
    }
  }

  Ok(SkillsMigrationResult {
    copied,
    skipped,
    replaced,
  })
}
