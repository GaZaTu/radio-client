use md5::{Digest, Md5};
use pwhash::{md5_crypt, sha256_crypt, sha512_crypt, HashSetup};
use tauri::{plugin::{Builder, TauriPlugin}, Runtime};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("pwhash")
    .invoke_handler(tauri::generate_handler![pwhash_create_md5_hash, pwhash_create_md5_password_hash, pwhash_create_sha256_password_hash, pwhash_create_sha512_password_hash])
    .setup(|_app, _| {
      return Ok(());
    })
    .build()
}

#[tauri::command]
fn pwhash_create_md5_hash(text: String) -> Result<String, String> {
  let mut hasher = Md5::new();
  hasher.update(text);

  let hash = hasher.finalize();
  let hash_hex = hex::encode(hash);

  return Ok(hash_hex);
}

#[tauri::command]
fn pwhash_create_md5_password_hash(password: String, salt: Option<String>, cost: Option<u32>) -> Result<String, String> {
  let hash = md5_crypt::hash_with(HashSetup { salt: salt.as_ref().map(|s| s.as_str()), rounds: cost }, password).map_err(|e| e.to_string())?;
  return Ok(hash);
}

#[tauri::command]
fn pwhash_create_sha256_password_hash(password: String, salt: Option<String>, cost: Option<u32>) -> Result<String, String> {
  let hash = sha256_crypt::hash_with(HashSetup { salt: salt.as_ref().map(|s| s.as_str()), rounds: cost }, password).map_err(|e| e.to_string())?;
  return Ok(hash);
}

#[tauri::command]
fn pwhash_create_sha512_password_hash(password: String, salt: Option<String>, cost: Option<u32>) -> Result<String, String> {
  let hash = sha512_crypt::hash_with(HashSetup { salt: salt.as_ref().map(|s| s.as_str()), rounds: cost }, password).map_err(|e| e.to_string())?;
  return Ok(hash);
}
