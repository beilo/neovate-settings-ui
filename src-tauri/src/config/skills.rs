use std::fs;
use std::path::PathBuf;

use super::SkillsMigrationItem;

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

pub fn build_skills_plan(source: &PathBuf, target: &PathBuf) -> Result<Vec<SkillsMigrationItem>, String> {
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

pub fn apply_skills_migration_core(
  items: Vec<SkillsMigrationItem>,
  mode: &str,
) -> Result<(usize, usize, usize), String> {
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

  Ok((copied, skipped, replaced))
}
