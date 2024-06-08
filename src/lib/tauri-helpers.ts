import { createAsyncMemo } from "@solid-primitives/memo"
import { getTauriVersion } from "@tauri-apps/api/app"

export const isTauri = async () => {
  try {
    return (await getTauriVersion()) !== undefined
  } catch {
    return false
  }
}

export const isTauriMemo = createAsyncMemo(isTauri)
