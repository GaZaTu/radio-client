fn main() {
  tauri_build::try_build(
  tauri_build::Attributes::new()
    .codegen(tauri_build::CodegenContext::new())
    .plugin(
      "pwhash",
      tauri_build::InlinedPlugin::new().commands(&[
        "pwhash_create_md5_hash",
        "pwhash_create_md5_password_hash",
        "pwhash_create_sha256_password_hash",
        "pwhash_create_sha512_password_hash",
      ]),
    )
    .app_manifest(
      tauri_build::AppManifest::new().commands(&[
        // empty
      ]),
    ),
  )
  .expect("failed to run tauri-build");
}
