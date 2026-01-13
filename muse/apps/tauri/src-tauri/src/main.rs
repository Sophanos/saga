//! Rhei Tauri application entry point

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    rhei_lib::run()
}
