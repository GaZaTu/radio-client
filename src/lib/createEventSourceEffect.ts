import { Toaster } from "@gazatu/solid-spectre/ui/Toaster"
import { debounce } from "debounce"
import { createEffect, onCleanup } from "solid-js"

const createEventSourceEffect = (effect: (ev: MessageEvent) => void, getUrl: () => Promise<string | URL>) => {
  let events: EventSource | undefined

  createEffect(() => {
    void (async () => {
      try {
        events = new EventSource(await getUrl())
        events.onmessage = debounce(effect, 1000)
      } catch (error) {
        Toaster.pushError(error)
      }
    })()
  })

  onCleanup(() => {
    events?.close()
  })
}

export default createEventSourceEffect
