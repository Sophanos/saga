//! Mythos Tauri application entry point

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mythos_lib::run()
}
