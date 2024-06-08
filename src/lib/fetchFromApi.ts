import { createSignal } from "solid-js"

const [defaultFetchInfo, setDefaultFetchInfo] = createSignal<string>()
const [defaultFetchInit, setDefaultFetchInit] = createSignal<RequestInit>()

export {
  defaultFetchInfo,
  setDefaultFetchInfo,
  defaultFetchInit,
  setDefaultFetchInit,
}

const mergeFetchParams = ([info, init]: Parameters<typeof fetch>, [defaultInfo, defaultInit]: Partial<Parameters<typeof fetch>>) => {
  if (info instanceof URL) {
    info = String(info)
  }

  if (typeof info === "string") {
    if (defaultInfo && !info.startsWith("http")) {
      info = `${defaultInfo}${info}`
    }
  }

  init = {
    ...defaultInit,
    ...init,
    headers: {
      ...defaultInit?.headers,
      ...init?.headers,
    },
  }

  return [info, init] as const
}

const fetchFromApi: (typeof fetch) = async (info, init) => {
  const defaultInfo = defaultFetchInfo()
  const defaultInit = defaultFetchInit()

  const response = await fetch(...mergeFetchParams([info, init], [defaultInfo, defaultInit]))
  return response
}

export default fetchFromApi

const fetchJson = async (...[info, init]: Parameters<typeof fetch>) => {
  const response = await fetchFromApi(info, init)
  if (response.status === 204) {
    return undefined
  }

  const json = await response.json() as any | undefined

  const errorMessage = json?.errors?.[0]?.message
  if (errorMessage) {
    throw new Error(errorMessage)
  }

  if (!response.ok) {
    throw new Error(response.statusText)
  }

  return json
}

export {
  fetchJson,
}
