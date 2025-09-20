import { Component, createEffect } from "solid-js"
import PCM16ProcessorURL from "./PCM16Processor.js?url"
import { Button } from "@gazatu/solid-spectre/ui/Button"
import { invoke } from "@tauri-apps/api/core"

const HomeView: Component = () => {
  // createEffect(() => {
  //   void (async () => {
  //   })()
  // })

  const onclick = async () => {
    // const audioContext = new AudioContext()

    // const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // const source = audioContext.createMediaStreamSource(stream)

    // await audioContext.audioWorklet.addModule(PCM16ProcessorURL)

    // const audioWorklet = new AudioWorkletNode(audioContext, "PCM16Processor")
    // audioWorklet.port.onmessage = (message: MessageEvent<Int16Array>) => {
    //   console.log(message.data)
    // }

    // source.connect(audioWorklet)

    await invoke("mic_record")
  }

  return (
    <div>
      <Button onclick={onclick}>TEST</Button>
    </div>
  )
}

export default HomeView
