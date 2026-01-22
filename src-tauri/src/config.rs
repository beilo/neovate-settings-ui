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

