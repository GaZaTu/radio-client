use std::{
  cell::RefCell, fs::OpenOptions, io::Write, rc::Rc, sync::{LazyLock, Mutex}, time::Duration
};

use codec2_sys::{codec2_bytes_per_frame, codec2_create, codec2_decode, codec2_destroy, codec2_encode, codec2_samples_per_frame, CODEC2, CODEC2_MODE_1200, CODEC2_MODE_3200};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use tauri::{async_runtime, Emitter, Manager};
use tauri_plugin_blec::{
  models::{BleDevice, ScanFilter, WriteType},
  OnDisconnectHandler,
};
use tokio::{sync::mpsc, time::timeout};
use uuid::{uuid, Uuid};

const LORA_SERVICE_ID: Uuid = uuid!("04ba00a8-8f96-404c-b2fc-c2adf2ce6700");
const LORA_SERVICE_FILTER: ScanFilter = ScanFilter::Service(LORA_SERVICE_ID);

const LORA_UUID_SEND: Uuid = uuid!("065877c5-023e-41b2-acd8-fcafaf67b846");
const LORA_UUID_RECV: Uuid = uuid!("29ac4891-00b9-42e7-9e3f-041405c743b6");
const LORA_UUID_SEND_AUDIO: Uuid = uuid!("17112441-1236-4199-8b6b-f61722bd967e");
const LORA_UUID_RECV_AUDIO: Uuid = uuid!("828e6e8e-bd63-42d5-ae20-324e7c9cf525");

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

struct Codec2 {
  ptr: *mut CODEC2,
}

impl Codec2 {
  fn create(mode: u32) -> Codec2 {
    unsafe {
      return Codec2 {
        ptr: codec2_create(mode.try_into().unwrap()),
      };
    }
  }

  fn samples_per_frame(&self) -> i32 {
    unsafe {
      return codec2_samples_per_frame(self.ptr);
    }
  }

  fn make_samples_frame(&self) -> Vec<i16> {
    return vec!(0; self.samples_per_frame().try_into().unwrap());
  }

  fn bytes_per_frame(&self) -> i32 {
    unsafe {
      return codec2_bytes_per_frame(self.ptr);
    }
  }

  fn make_bytes_frame(&self) -> Vec<u8> {
    return vec!(0; self.bytes_per_frame().try_into().unwrap());
  }

  fn encode(&self, bytes: &mut [u8], speech_in: &[i16]) {
    unsafe {
      codec2_encode(self.ptr, bytes.as_mut_ptr(), speech_in.as_ptr().cast_mut());
    }
  }

  fn decode(&self, speech_out: &mut [i16], bytes: &[u8]) {
    unsafe {
      codec2_decode(self.ptr, speech_out.as_mut_ptr(), bytes.as_ptr().cast_mut());
    }
  }
}

impl Drop for Codec2 {
  fn drop(&mut self) {
    unsafe {
      codec2_destroy(self.ptr);
    }
  }
}

unsafe impl Send for Codec2 {}
unsafe impl Sync for Codec2 {}

#[tauri::command]
async fn mic_record() -> Result<(), String> {
  let (tx, mut rx) = mpsc::unbounded_channel::<Vec<u8>>();

  let codec2 = Codec2::create(CODEC2_MODE_1200);
  let mut samples = codec2.make_samples_frame();
  let mut samples_len: usize = 0;
  let mut encoded = codec2.make_bytes_frame();

  let host = cpal::default_host();
  let input_device = host.default_input_device().unwrap();
  let input_config = input_device.default_input_config().unwrap();
  let input_stream = input_device.build_input_stream_raw(
    &input_config.into(),
    cpal::SampleFormat::I16,
    move |data, _| {
      let data_samples = data.as_slice::<i16>().unwrap();

      let mut idx: usize = 0;
      while idx < data.len() {
        let slice_len = samples.len() - samples_len;
        let end = std::cmp::min(idx + slice_len, data.len());
        let data_slice = &data_samples[idx..end];

        if samples_len > 0 {
          samples[samples_len..].copy_from_slice(data_slice);
          samples_len = 0;

          codec2.encode(encoded.as_mut_slice(), samples.as_slice());
          tx.send(encoded.clone()).unwrap();
          idx += samples.len();
          continue;
        }

        if data_slice.len() < samples.len() {
          samples[..data_slice.len()].copy_from_slice(data_slice);
          samples_len = data_samples.len() - idx;
          break;
        }

        codec2.encode(encoded.as_mut_slice(), data_slice);
        tx.send(encoded.clone()).unwrap();
        idx += samples.len();
      }
    },
    |err| {
      eprintln!("an error occurred on stream: {err}");
    },
    None,
  ).unwrap();

  input_stream.play().unwrap();

  let ble = tauri_plugin_blec::get_handler().unwrap();

  println!("lora_connect sending...");
  let send_future = ble.send_data(
    LORA_UUID_SEND_AUDIO,
    result.borrow().as_slice(),
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

  input_stream.pause().unwrap();

  return Ok(());
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
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
      mic_record,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
