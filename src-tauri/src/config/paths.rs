use std::path::PathBuf;

// 为什么：不引入额外依赖（dirs 等），用最朴素的环境变量拿到 Home，够用且可控。
pub fn home_dir() -> Result<PathBuf, String> {
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

// 为什么：允许用户输入 ~ 作为主目录缩写，提升通用性与易用性。
pub fn expand_tilde(path: &str) -> Result<PathBuf, String> {
  if let Some(stripped) = path.strip_prefix("~/").or_else(|| path.strip_prefix("~\\")) {
    return Ok(home_dir()?.join(stripped));
  }
  if path.trim() == "~" {
    return Ok(home_dir()?);
  }
  Ok(PathBuf::from(path))
}

// 为什么：统一配置路径出口，避免多处拼接。
pub fn config_path() -> Result<PathBuf, String> {
  Ok(home_dir()?.join(".neovate").join("config.json"))
}
