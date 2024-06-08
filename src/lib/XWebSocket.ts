import TauriWebSocket, { Message } from "@tauri-apps/plugin-websocket"
import { isTauri } from "./tauri-helpers"

class XWebSocket {
  private constructor(
    public readonly addListener: (cb: (arg: Message) => void) => void,
    public readonly send: (message: string | number[] | Message) => void,
    public readonly disconnect: () => void,
  ) { }

  static async connect(url: string) {
    if (await isTauri()) {
      const socket = await TauriWebSocket.connect(url)

      return new XWebSocket(
        listener => socket.addListener(listener),
        message => socket.send(message),
        () => socket.disconnect(),
      )
    } else {
      const socket = new WebSocket(url)
      await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve)
        socket.addEventListener("error", reject)
      })

      return new XWebSocket(
        listener => {
          socket.addEventListener("message", event => {
            listener({
              type: (typeof event.data === "string") ? "Text" : "Binary",
              data: event.data,
            })
          })
          socket.addEventListener("close", event => {
            listener({
              type: "Close",
              data: {
                code: event.code,
                reason: event.reason,
              },
            })
          })
        },
        message => {
          if (typeof message === "string") {
            socket.send(message)
            return
          }
          if (Array.isArray(message)) {
            socket.send(new Uint8Array(message))
            return
          }
          switch (message.type) {
          case "Text":
            socket.send(message.data)
            break
          case "Binary":
            socket.send(new Uint8Array(message.data))
            break
          case "Close":
            socket.close(message.data?.code, message.data?.reason)
            break
          }
        },
        () => {
          socket.close()
        },
      )
    }
  }
}

export default XWebSocket
