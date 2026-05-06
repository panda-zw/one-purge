pub mod recipes;

use anyhow::Result;
use chrono::Utc;
use tauri::{AppHandle, Emitter};
use tokio::task::JoinSet;

use crate::models::scan::{ScanItem, ScanResult, CategoryResult};

pub async fn run_scan(app_handle: AppHandle) -> Result<ScanResult> {
    let started_at = Utc::now().timestamp();
    let mut join_set = JoinSet::new();

    // JavaScript / Node
    join_set.spawn(recipes::node::scan_node_modules());
    join_set.spawn(recipes::node::scan_node_caches());
    // Docker
    join_set.spawn(recipes::docker::scan_docker_images());
    join_set.spawn(recipes::docker::scan_docker_build_cache());
    // Xcode / iOS
    join_set.spawn(recipes::xcode::scan_simulators());
    join_set.spawn(recipes::xcode::scan_derived_data());
    // Android / Gradle
    join_set.spawn(recipes::android::scan_gradle_cache());
    // System
    join_set.spawn(recipes::system::scan_library_caches());
    join_set.spawn(recipes::system::scan_homebrew_cache());
    // Rust
    join_set.spawn(recipes::rust::scan_rust_targets());
    join_set.spawn(recipes::rust::scan_cargo_caches());
    // Python
    join_set.spawn(recipes::python::scan_python_caches());
    join_set.spawn(recipes::python::scan_python_venvs());
    // Go
    join_set.spawn(recipes::go::scan_go_cache());
    // Java / Maven
    join_set.spawn(recipes::maven::scan_maven_cache());
    // Ruby, .NET, Flutter, CocoaPods, PHP, IDE
    join_set.spawn(recipes::misc::scan_ruby_cache());
    join_set.spawn(recipes::misc::scan_dotnet_cache());
    join_set.spawn(recipes::misc::scan_flutter_cache());
    join_set.spawn(recipes::misc::scan_cocoapods_cache());
    join_set.spawn(recipes::misc::scan_composer_cache());
    join_set.spawn(recipes::misc::scan_ide_caches());
    // macOS system data
    join_set.spawn(recipes::macos::scan_xcode_device_support());
    join_set.spawn(recipes::macos::scan_xcode_archives());
    join_set.spawn(recipes::macos::scan_browser_caches());
    join_set.spawn(recipes::macos::scan_system_logs());
    join_set.spawn(recipes::macos::scan_ios_backups());
    join_set.spawn(recipes::macos::scan_trash());
    join_set.spawn(recipes::macos::scan_old_downloads());
    join_set.spawn(recipes::macos::scan_time_machine_snapshots());
    join_set.spawn(recipes::macos::scan_documents());
    join_set.spawn(recipes::macos::scan_app_data());

    let mut all_items: Vec<ScanItem> = Vec::new();

    while let Some(result) = join_set.join_next().await {
        match result {
            Ok(Ok(items)) => {
                if !items.is_empty() {
                    let _ = app_handle.emit("scan:progress", &items);
                    all_items.extend(items);
                }
            }
            Ok(Err(e)) => {
                log::warn!("Scanner recipe error: {e}");
            }
            Err(e) => {
                log::warn!("Scanner task join error: {e}");
            }
        }
    }

    let completed_at = Utc::now().timestamp();
    let result = build_scan_result(all_items, started_at, completed_at);
    Ok(result)
}

fn build_scan_result(items: Vec<ScanItem>, started_at: i64, completed_at: i64) -> ScanResult {
    use std::collections::HashMap;

    let mut category_map: HashMap<String, Vec<ScanItem>> = HashMap::new();
    for item in items {
        let key = item.category.as_str().to_string();
        category_map.entry(key).or_default().push(item);
    }

    let mut categories: Vec<CategoryResult> = category_map
        .into_iter()
        .map(|(_key, mut items)| {
            items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
            let category = items[0].category.clone();
            let total_bytes: u64 = items.iter().map(|i| i.size_bytes).sum();
            CategoryResult {
                display_name: category.display_name().to_string(),
                description: category.description().to_string(),
                category,
                total_bytes,
                items,
            }
        })
        .collect();

    categories.sort_by(|a, b| b.total_bytes.cmp(&a.total_bytes));

    let total_bytes: u64 = categories.iter().map(|c| c.total_bytes).sum();

    ScanResult {
        started_at,
        completed_at: Some(completed_at),
        total_bytes,
        categories,
    }
}
