import { createEffect, onCleanup } from "solid-js"

type AsyncEffect = {
  cancelled: boolean
  onCleanup: (() => void)[]
}

const createAsyncEffect = (fn: (effect: AsyncEffect) => void) => {
  createEffect<AsyncEffect>(prevEffect => {
    if (prevEffect) {
      prevEffect.cancelled = true
    }

    const thisEffect: AsyncEffect = {
      cancelled: false,
      onCleanup: [],
    }

    fn(thisEffect)

    onCleanup(() => {
      for (const unlisten of thisEffect.onCleanup) {
        unlisten()
      }
    })

    return thisEffect
  })
}

export default createAsyncEffect
