use std::{
  sync::{LazyLock, Mutex},
  time::Duration,
};

use tauri::{async_runtime, Emitter, Manager};
use tauri_plugin_blec::{
  models::{BleDevice, ScanFilter, WriteType},
  OnDisconnectHandler,
};
use tokio::time::timeout;
use uuid::{uuid, Uuid};

const LORA_SERVICE_ID: Uuid = uuid!("04ba00a8-8f96-404c-b2fc-c2adf2ce6700");
const LORA_UUID_SEND: Uuid = uuid!("065877c5-023e-41b2-acd8-fcafaf67b846");
const LORA_UUID_RECV: Uuid = uuid!("29ac4891-00b9-42e7-9e3f-041405c743b6");

const LORA_SERVICE_FILTER: ScanFilter = ScanFilter::Service(LORA_SERVICE_ID);

struct LoraState {
  name: String,
  address: String,
  disconnecting: bool,
  connecting: bool,
  connected: bool,
  reconnect: bool,
}

static LORA_STATE: LazyLock<Mutex<LoraState>> = std::sync::LazyLock::new(|| {
  Mutex::new(LoraState {
    name: "".to_string(),
    address: "".to_string(),
    disconnecting: false,
    connecting: false,
    connected: false,
    reconnect: false,
  })
});

#[tauri::command]
async fn lora_connect(app_handle: tauri::AppHandle, name: String) -> Result<(), String> {
  println!("lora_connect begin");

  {
    let mut state = LORA_STATE.lock().unwrap();
    if state.connecting || state.connected {
      return Ok(());
    }
    state.connecting = true;
    state.name = name.clone();
  }

  let ble = tauri_plugin_blec::get_handler().unwrap();

  let mut address;
  {
    let state = LORA_STATE.lock().unwrap();
    address = state.address.clone();
  }

  if address.is_empty() {
    for _ in 0..5 {
      println!("lora_connect discover?");
      let (tx, mut rx) = async_runtime::channel::<Vec<BleDevice>>(1);
      let discover_future = ble.discover(Some(tx), 2000, LORA_SERVICE_FILTER);
      if let Err(_) = timeout(Duration::from_millis(2500), discover_future).await {
        // ignore
      }
      println!("lora_connect discover:done");
      while let Some(devices) = rx.recv().await {
        for device in devices {
          if name.len() > 0 && name != device.name {
            continue;
          }
          address = device.address.clone();
          break;
        }
      }
      if address.is_empty() {
        continue;
      }
      break;
    }

    if address.is_empty() {
      {
        let mut state = LORA_STATE.lock().unwrap();
        state.connecting = false;
      }
      return Err("lora failed to discover".to_string());
    }

    {
      let mut state = LORA_STATE.lock().unwrap();
      state.address = address.clone();
    }
  }

  println!("lora_connect address:{address}");
  ble
    .connect(&address, OnDisconnectHandler::None)
    .await
    .map_err(|e| e.to_string())?;
  println!("lora_connect connect:done");

  {
    let mut state = LORA_STATE.lock().unwrap();
    state.connecting = false;
    state.connected = true;
    state.reconnect = true;
  }

  println!("lora_connect subscribe?");
  ble
    .subscribe(LORA_UUID_RECV, move |vec| {
      let str = String::from_utf8(vec).unwrap();
      println!("lora_connect emit:{str}");
      app_handle.emit("lora_recv", str).unwrap();
    })
    .await
    .map_err(|e| e.to_string())?;
  println!("lora_connect subscribe:done");

  return Ok(());
}

#[tauri::command]
async fn lora_disconnect() -> Result<(), String> {
  {
    let mut state = LORA_STATE.lock().unwrap();
    state.disconnecting = true;
    state.connected = false;
    state.reconnect = false;
  }

  let ble = tauri_plugin_blec::get_handler().unwrap();

  println!("lora_connect disconnecting...");
  let disconnect_future = ble.disconnect();
  if let Err(_) = timeout(Duration::from_millis(5000), disconnect_future).await {
    // ignore
  }
  println!("lora_connect disconnect:done");

  {
    let mut state = LORA_STATE.lock().unwrap();
    state.disconnecting = false;
  }

  return Ok(());
}

#[tauri::command]
fn lora_is_disconnecting() -> bool {
  let state = LORA_STATE.lock().unwrap();
  return state.disconnecting;
}

#[tauri::command]
async fn lora_send(payload: &str) -> Result<(), String> {
  let ble = tauri_plugin_blec::get_handler().unwrap();

  println!("lora_connect sending...");
  let send_future = ble.send_data(
    LORA_UUID_SEND,
    payload.as_bytes(),
    WriteType::WithoutResponse,
  );
  match timeout(Duration::from_millis(5000), send_future).await {
    Ok(r) => {
      r.map_err(|e| e.to_string())?;
    }
    Err(_) => {
      return Err("lora send timeout".to_string());
    }
  }
  println!("lora_connect send:done");

  return Ok(());
}

async fn lora_listen_to_connection_updates(app_handle: tauri::AppHandle) -> Result<(), String> {
  let ble = tauri_plugin_blec::get_handler().unwrap();

  let (tx, mut rx) = async_runtime::channel(1);
  ble.set_connection_update_channel(tx).await;
  while let Some(connected) = rx.recv().await {
    let mut state = LORA_STATE.lock().unwrap();
    state.connected = connected;
    println!("lora_connect connected:{connected}");
    app_handle
      .emit("lora_connection_update", connected)
      .unwrap();
    if !connected && state.reconnect {
      async_runtime::spawn(lora_connect(app_handle.clone(), state.name.clone()));
    }
  }

  return Ok(());
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_os::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_blec::init())
    .plugin(tauri_plugin_geolocation::init())
    .setup(|app| {
      async_runtime::spawn(lora_listen_to_connection_updates(
        app.app_handle().to_owned(),
      ));
      return Ok(());
    })
    .invoke_handler(tauri::generate_handler![
      lora_connect,
      lora_disconnect,
      lora_is_disconnecting,
      lora_send,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
