// 为什么：Windows 发布版避免额外弹出控制台窗口（Tauri 官方推荐写法）。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  app_lib::run();
}
