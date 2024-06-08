import { Button } from "@gazatu/solid-spectre/ui/Button"
import { Section } from "@gazatu/solid-spectre/ui/Section"
import { Toaster } from "@gazatu/solid-spectre/ui/Toaster"
import { Divider } from "@gazatu/solid-spectre/ui/Divider"
import { Component, createEffect, createSignal, onCleanup } from "solid-js"
import XWebSocket from "../lib/XWebSocket"

type RadioMessage = {
  type: "message"
  rssi: number
  snr: number
  ferr: number
  tx: {
    rssi: number
    snr: number
    ferr: number
  }
}

type RadioEvent = RadioMessage | {
  type: "preamble"
} | {
  type: "sent"
}

const relativeTimeFormat = new Intl.RelativeTimeFormat("en", { style: "long" })

const HomeView: Component = () => {
  let failed = false

  let txBeginAt = 0
  let txEndAt = 0
  let rxBeginAt = 0
  let rxEndAt = 0

  const [getTxBeginAtText, setTxBeginAtText] = createSignal<string>()
  const [getTxEndAtText, setTxEndAtText] = createSignal<string>()
  const [getRxBeginAtText, setRxBeginAtText] = createSignal<string>()
  const [getRxEndAtText, setRxEndAtText] = createSignal<string>()

  const intervalId = setInterval(() => {
    if (txBeginAt) {
      const diffInSeconds = Math.round((txBeginAt - Date.now()) / 1000)
      setTxBeginAtText(relativeTimeFormat.format(diffInSeconds, "seconds"))
    }
    if (txEndAt) {
      const diffInSeconds = Math.round((txEndAt - Date.now()) / 1000)
      setTxEndAtText(relativeTimeFormat.format(diffInSeconds, "seconds"))
    }
    if (rxBeginAt) {
      const diffInSeconds = Math.round((rxBeginAt - Date.now()) / 1000)
      setRxBeginAtText(relativeTimeFormat.format(diffInSeconds, "seconds"))
    }
    if (rxEndAt) {
      const diffInSeconds = Math.round((rxEndAt - Date.now()) / 1000)
      setRxEndAtText(relativeTimeFormat.format(diffInSeconds, "seconds"))
    }
  }, 500)
  onCleanup(() => {
    clearInterval(intervalId)
  })

  const [getMessages, setMessages] = createSignal([] as RadioMessage[])

  const [getSocket, setSocket] = createSignal<XWebSocket>()
  createEffect(() => {
    void (async () => {
      try {
        // const socket = await XWebSocket.connect("ws://192.168.0.62/ws")
        const socket = await XWebSocket.connect("ws://192.168.4.1/ws")
        setSocket(socket)

        socket.addListener(message => {
          if (message.type !== "Text") {
            return
          }

          const event = JSON.parse(message.data) as RadioEvent
          switch (event.type) {
          case "sent":
            txEndAt = Date.now()
            break
          case "preamble":
            rxBeginAt = Date.now()
            break
          case "message":
            rxEndAt = Date.now()
            setMessages(p => [event])
            setTimeout(send, 2000)
            break
          }
        })
      } catch (error) {
        failed = true
        Toaster.pushError(error)
      }
    })()
  })
  onCleanup(() => {
    getSocket()?.disconnect()
  })

  const send = async () => {
    if (failed) {
      return
    }

    try {
      await getSocket()?.send(JSON.stringify({ str: "testlol" }))
      txBeginAt = Date.now()
    } catch (error) {
      failed = true
      Toaster.pushError(error)
    }
  }

  return (
    <>
      <Section size="xl" marginY style={{ "flex-grow": 1 }}>
        <p>Tx (begin): {getTxBeginAtText() ?? "N/A"}</p>
        <p>Tx (end): {getTxEndAtText() ?? "N/A"}</p>
        <p>Rx (begin): {getRxBeginAtText() ?? "N/A"}</p>
        <p>Rx (end): {getRxEndAtText() ?? "N/A"}</p>
        <Divider />
        <p>RSSI (tx): {getMessages()?.[0]?.tx?.rssi?.toFixed(0) ?? "N/A"} dBm</p>
        <p>SNR (tx): {getMessages()?.[0]?.tx?.snr?.toFixed(2) ?? "N/A"} dB</p>
        <p>FErr (tx): {getMessages()?.[0]?.tx?.ferr?.toFixed(0) ?? "N/A"} Hz</p>
        <Divider />
        <p>RSSI (rx): {getMessages()?.[0]?.rssi?.toFixed(0) ?? "N/A"} dBm</p>
        <p>SNR (rx): {getMessages()?.[0]?.snr?.toFixed(2) ?? "N/A"} dB</p>
        <p>FErr (rx): {getMessages()?.[0]?.ferr?.toFixed(0) ?? "N/A"} Hz</p>
      </Section>

      <Section size="xl" marginY style={{ "margin-bottom": "0.5rem" }}>
        <Button onclick={send} style={{ "width": "100%" }}>Send</Button>
      </Section>
    </>
  )
}

export default HomeView
