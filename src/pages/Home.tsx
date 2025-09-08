import "./Home.scss"
//
import { iconMessageSquare } from "@gazatu/solid-spectre/icons/iconMessageSquare"
import { iconRadio } from "@gazatu/solid-spectre/icons/iconRadio"
import { iconSend } from "@gazatu/solid-spectre/icons/iconSend"
import { iconSettings } from "@gazatu/solid-spectre/icons/iconSettings"
import { A } from "@gazatu/solid-spectre/ui/A"
import { Button } from "@gazatu/solid-spectre/ui/Button"
import { Column } from "@gazatu/solid-spectre/ui/Column"
import { Form } from "@gazatu/solid-spectre/ui/Form"
import { Icon } from "@gazatu/solid-spectre/ui/Icon"
import { Input } from "@gazatu/solid-spectre/ui/Input"
import { Navbar } from "@gazatu/solid-spectre/ui/Navbar"
import { Section } from "@gazatu/solid-spectre/ui/Section"
import { Select } from "@gazatu/solid-spectre/ui/Select"
import { Tabs } from "@gazatu/solid-spectre/ui/Tabs"
import { Toast } from "@gazatu/solid-spectre/ui/Toast"
import { Toaster } from "@gazatu/solid-spectre/ui/Toaster"
import { badge } from "@gazatu/solid-spectre/util/badge"
import { makePersisted } from "@solid-primitives/storage"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { writeTextFile } from "@tauri-apps/plugin-fs"
import * as notifications from "@tauri-apps/plugin-notification"
import { Component, createMemo, createSignal, For, Show } from "solid-js"
import compass_arrow_svg from "../assets/compass_arrow.svg"
import compass_marker_svg from "../assets/compass_marker.svg"
import compass_ring_svg from "../assets/compass_ring.svg"
import createAsyncEffect from "../lib/createAsyncEffect"
import saveFile from "../lib/saveFile"

const LoRaBandwidthOptions = [
  7.8, 10.4, 15.6, 20.8, 31.25, 41.7, 62.5, 125,
] as const

type LoRaBandwidth = (typeof LoRaBandwidthOptions)[number]

const LoRaSpreadingFactorOptions = [
  5, 6, 7, 8, 9, 10, 11, 12,
] as const

type LoRaSpreadingFactor = (typeof LoRaSpreadingFactorOptions)[number]

const LoRaCodingRateOptions = [
  5, 6, 7, 8,
] as const

type LoRaCodingRate = (typeof LoRaCodingRateOptions)[number]

type LoRaSendEventMap = {
  "": {}
  "signal": {}
  "get-config": {}
  "set-config": {
    bw: LoRaBandwidth
    sf: LoRaSpreadingFactor
    cr: LoRaCodingRate
  }
  "message": {
    text: string
  }
  "toggle-screen": {}
}

type LoRaSendEvent = {
  [K in keyof LoRaSendEventMap]: LoRaSendEventMap[K] & { type: K }
}[keyof LoRaSendEventMap]

type LoRaRecvEventMap = {
  "sent": {}
  "preamble": {}
  "signal": {
    rx: {
      rssi: number
      snr: number
      ferr: number
    }
    tx: {
      rssi: number
      snr: number
      ferr: number
    }
  }
  "config": {
    bw: LoRaBandwidth
    sf: LoRaSpreadingFactor
    cr: LoRaCodingRate
    battery: number
    screenOn: boolean
  }
  "message": {
    source: string
    text: string
  }
}

type LoRaRecvEvent = {
  [K in keyof LoRaRecvEventMap]: LoRaRecvEventMap[K] & { type: K }
}[keyof LoRaRecvEventMap]

class LoRa {
  static async connect(name: string) {
    await invoke("lora_connect", { name })
  }

  static async disconnect() {
    await invoke("lora_disconnect")
  }

  static async isDisconnecting() {
    return await invoke<boolean>("lora_is_disconnecting")
  }

  static get disconnectDone() {
    return (async () => {
      const disconnecting = () => invoke<boolean>("lora_is_disconnecting")
      const timeout = () => new Promise(r => setTimeout(r, 100))
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (await disconnecting()) {
          await timeout()
          continue
        } else {
          break
        }
      }
    })()
  }

  static async onConnectionUpdate(handler: (c: boolean) => void) {
    return await listen<boolean>("lora_connection_update", ({ payload }) => {
      if (payload) {
        this.send({ type: "get-config" })
      }
      handler(payload)
    })
  }

  static async send(ev: LoRaSendEvent) {
    await invoke("lora_send", {
      payload: JSON.stringify(ev),
    })
  }

  static async onRecv(handler: (ev: LoRaRecvEvent) => void) {
    return await listen<string>("lora_recv", ({ payload }) => {
      const ev = JSON.parse(payload) as LoRaRecvEvent
      handler(ev)
    })
  }

  static async onRecvByMap(handlers: { [K in keyof LoRaRecvEventMap]: (ev: LoRaRecvEventMap[K]) => void }) {
    return await this.onRecv(ev => handlers[ev.type](ev as any))
  }

  static async onRecvOnce<T extends keyof LoRaRecvEventMap>(type: T) {
    return new Promise<LoRaRecvEventMap[T]>((resolve, reject) => {
      void (async () => {
        const unlisteners = [
          await this.onConnectionUpdate(connected => {
            if (!connected) {
              unlisteners.forEach(ul => ul())
              reject()
            }
          }),
          await this.onRecv(ev => {
            if (ev.type === type) {
              unlisteners.forEach(ul => ul())
              resolve(ev as any)
            }
          }),
        ]
      })()
    })
  }

  static async getConfig() {
    await this.send({ type: "get-config" })
    const result = await this.onRecvOnce("config")
    return result
  }

  static async setConfig(config: LoRaSendEventMap["set-config"]) {
    await this.send({ type: "set-config", ...config })
  }

  static calculateTimeOnAir(settings: { bw: number, sf: number, cr: number } & { payload: number, preamble: number }) {
    const symbolTime = Math.pow(2, settings.sf) / settings.bw
    const preambleTime = (settings.preamble + 4.25) * symbolTime
    const payloadBits = (settings.payload * 8) - (4 * settings.sf) + 8
    const symbols = Math.ceil(payloadBits / 4 / settings.sf) * settings.cr + 8
    const payloadTime = symbols * symbolTime

    const totalTime = preambleTime + payloadTime
    const throughput = ((8 * settings.payload) / totalTime) * 1000

    return {
      totalTime,
      throughput,
    }
  }
}

type GeolocationCoordinatesMin = Pick<GeolocationCoordinates, "latitude" | "longitude">

const calculateGeolocationDistanceInMeters = (pos1: GeolocationCoordinatesMin, pos2: GeolocationCoordinatesMin) => {
  const R = 6371e3 // meters
  const φ1 = pos1.latitude * Math.PI / 180
  const φ2 = pos2.latitude * Math.PI / 180
  const Δφ = (pos2.latitude - pos1.latitude) * Math.PI / 180
  const Δλ = (pos2.longitude - pos1.longitude) * Math.PI / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1 + 0) * Math.cos(φ2 + 0) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  const distance = R * c // in meters
  return distance
}

const calculateGeolocationBearingInDegrees = (pos1: GeolocationCoordinatesMin, pos2: GeolocationCoordinatesMin) => {
  const φ1 = pos1.latitude * Math.PI / 180
  const φ2 = pos2.latitude * Math.PI / 180
  const λ1 = pos1.longitude * Math.PI / 180
  const λ2 = pos2.longitude * Math.PI / 180

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
  const θ = Math.atan2(y, x)

  const bearing = (θ * 180 / Math.PI + 360) % 360 // in degrees
  return bearing
}

const getCurrentCoordinates = async () => {
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000,
      })
    })
    return position.coords
  } catch (error) {
    return undefined
  }
}

export const getDownloadDir = async () => {
  return "/sdcard/Download"
  // if (await isAndroid()) {
  //   return "/sdcard/Download"
  // } else {
  //   return await downloadDir()
  // }
}

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  hourCycle: "h24",
})

const HomeView: Component = () => {
  const [getReady, setReady] = createSignal(false)

  const [getLogMessage, setLogMessage] = createSignal("waiting...")
  const log = (...data: any[]) => {
    console.log(...data)
    setLogMessage(`${timeFormat.format(new Date())} ${data.join(" ")}`)
  }

  const [getDeviceName, setDeviceName] = makePersisted(createSignal(""), {
    name: "device-name",
  })

  const [getBandwidth, setBandwidth] = createSignal<LoRaBandwidth>(20.8)
  const [getSpreadFactor, setSpreadFactor] = createSignal<LoRaSpreadingFactor>(10)
  const [getCodingRate, setCodingRate] = createSignal<LoRaCodingRate>(6)
  const getConfig = createMemo(() => {
    return { bw: getBandwidth(), sf: getSpreadFactor(), cr: getCodingRate() }
  })

  const [getBattery, setBattery] = createSignal(0)

  const [getHome, setHome] = makePersisted(createSignal<GeolocationCoordinatesMin>(), {
    name: "home-coordinates",
  })

  const [getLocation, setLocation] = createSignal<GeolocationCoordinatesMin>()
  let updateLocationPromise = Promise.resolve()
  const updateLocation = async () => {
    setLocation(await getCurrentCoordinates())
  }

  const getDistance = createMemo(() => {
    const location = getLocation()
    const home = getHome()

    if (!location || !home) {
      return -1
    }

    const distance = calculateGeolocationDistanceInMeters(location, home)
    return distance
  })

  const getBearing = createMemo(() => {
    const location = getLocation()
    const home = getHome()

    if (!location || !home) {
      return -1
    }

    const bearing = calculateGeolocationBearingInDegrees(location, home)
    return bearing
  })

  const getTimeOnAir = createMemo(() => {
    const { totalTime } = LoRa.calculateTimeOnAir({ ...getConfig(), payload: 42, preamble: 8 })
    return totalTime
  })

  const [getSignalStrength, setSignalStrength] = createSignal<LoRaRecvEventMap["signal"]>({
    tx: {
      rssi: 0,
      snr: 0,
      ferr: 0,
    },
    rx: {
      rssi: 0,
      snr: 0,
      ferr: 0,
    },
  })

  const [getStoredData, setStoredData] = makePersisted(createSignal<(LoRaRecvEventMap["signal"] & Omit<LoRaRecvEventMap["config"], "battery" | "screenOn"> & { distance: number })[]>([]), {
    name: "stored-data",
  })

  createAsyncEffect(async effect => {
    const deviceName = getDeviceName()

    await LoRa.disconnectDone

    log("connecting...")
    try {
      await LoRa.connect(deviceName)
      log("connected")
    } catch (error) {
      log(String(error))
    }

    effect.onCleanup.push(
      async () => {
        log("cleanup")
        await LoRa.disconnect()
      },
    )

    effect.onCleanup.push(
      await LoRa.onConnectionUpdate(connected => {
        setReady(connected)
        if (connected) {
          log("connected")
        } else {
          log("disconnected")
        }
      }),
    )

    effect.onCleanup.push(
      await LoRa.onRecv(async ev => {
        switch (ev.type) {
        case "config":
          setBandwidth(ev.bw)
          setSpreadFactor(ev.sf)
          setCodingRate(ev.cr)
          setBattery(ev.battery)
          break
        case "signal":
          log("recv signal")
          setReady(true)
          setSignalStrength(ev)
          await updateLocationPromise
          setStoredData(d => [...d, { ...ev, ...getConfig(), distance: getDistance() }])
          break
        case "preamble":
          log("recv preamble")
          // setReady(false)
          break
        case "sent":
          log("sent")
          setReady(true)
          break
        case "message":
          log("new message")
          addChatMessage({ date: new Date(), source: "_placeholder", text: ev.text })
          notifyUser()
          break
        }
      }),
    )

    LoRa.getConfig().catch()
    setReady(true)
  })

  const notifyUser = async () => {
    if (!document.hidden) {
      return
    }
    let permissionGranted = await notifications.isPermissionGranted()
    if (!permissionGranted) {
      const permission = await notifications.requestPermission()
      permissionGranted = permission === "granted"
    }
    if (permissionGranted) {
      const lastMessage = getChat().findLast(_ => true)!
      notifications.sendNotification(`${lastMessage.source}: ${lastMessage.text}`)
    }
  }

  const ping = async () => {
    setReady(false)
    log("sending...")
    try {
      updateLocationPromise = updateLocation()
      await LoRa.connect(getDeviceName())
      await LoRa.send({ type: "signal" })
    } catch (error) {
      log(error)
      setReady(true)
    }
  }

  const saveConfig = async () => {
    setReady(false)
    log("configuring...")
    await LoRa.setConfig(getConfig())
  }

  const setHomeToCurrentLocation = async () => {
    setHome(await getCurrentCoordinates())
    setLogMessage(`home: ${getHome()?.latitude}, ${getHome()?.longitude}`)
  }

  const exportStoredData = async () => {
    const filePath = `${await getDownloadDir()}/radio-export.json`
    writeTextFile(filePath, JSON.stringify(getStoredData()))
    Toaster.pushSuccess(`exported ${filePath}`)
    setStoredData([])
  }

  const [getActiveTab, setActiveTab] = createSignal("config")

  type ChatMessage = { date: Date, source: string, text: string, outbound?: boolean, status?: string }
  const [getChat, setChat] = createSignal<ChatMessage[]>([])
  const addChatMessage = (message: ChatMessage) => {
    setChat(c => [...c, message])

    const chatWindow = document.getElementById("chat-window")
    chatWindow?.scroll({
      top: chatWindow.scrollHeight,
    })
  }

  const [getOutbound, setOutbound] = createSignal("")
  const getOutboundTimeOnAir = createMemo(() => {
    const payload = getOutbound().length
    const { totalTime } = LoRa.calculateTimeOnAir({ ...getConfig(), payload, preamble: 8 })
    return totalTime * 1.2
  })

  const send = async () => {
    setReady(false)
    log("sending...")
    try {
      await LoRa.connect(getDeviceName())
      await LoRa.send({ type: "message", text: getOutbound() })
      addChatMessage({ date: new Date(), source: "you", text: getOutbound(), outbound: true })
      setOutbound("")
    } catch (error) {
      log(error)
      setReady(true)
    }
  }

  const [getCompass, setCompass] = createSignal(-1)
  if (window.DeviceOrientationEvent) {
    window.addEventListener("deviceorientationabsolute", ev => {
      let compass = -(ev.alpha! + ev.beta! * ev.gamma! / 90)
      compass -= Math.floor(compass / 360) * 360

      setCompass(compass)
    })
  }

  return (
    <>
      <Tabs class="Home" block bottomNav activeId={getActiveTab} setActiveId={setActiveTab}>
        <Tabs.Panel id="config" header={<A><Icon src={iconSettings} /> Config</A>}>
          <Section size="xl" marginY>
            <Column.Row>
              <Column>
                <Form.Group label="Device">
                  <Input value={getDeviceName()} oninput={ev => setDeviceName(ev.currentTarget.value)} />
                </Form.Group>
              </Column>
              <Column>
                <Form.Group label="Bandwidth">
                  <Select value={`${getBandwidth().toFixed(2)} KHz`} onchange={ev => setBandwidth(parseFloat(ev.currentTarget.value) as any)}>
                    <For each={LoRaBandwidthOptions}>
                      {option => (
                        <option selected={(Math.abs(option - getBandwidth()) < 1e-5)}>{option.toFixed(2)} KHz</option>
                      )}
                    </For>
                  </Select>
                </Form.Group>
              </Column>
            </Column.Row>
            <Column.Row>
              <Column>
                <Form.Group label="Spreading Factor">
                  <Select value={getSpreadFactor()} onchange={ev => setSpreadFactor(Number(ev.currentTarget.value) as any)}>
                    <For each={LoRaSpreadingFactorOptions}>
                      {option => (
                        <option selected={option === getSpreadFactor()}>{option}</option>
                      )}
                    </For>
                  </Select>
                </Form.Group>
              </Column>
              <Column>
                <Form.Group label="Coding Rate">
                  <Select value={`4/${getCodingRate()}`} onchange={ev => setCodingRate(Number(ev.currentTarget.value.split("/")[1]) as any)}>
                    <For each={LoRaCodingRateOptions}>
                      {option => (
                        <option selected={option === getCodingRate()}>4/{option}</option>
                      )}
                    </For>
                  </Select>
                </Form.Group>
              </Column>
            </Column.Row>

            <Form.Group>
              <Column.Row style={{ "margin-top": "0.5rem" }}>
                <Column xxl={7}>
                  <span>ToA (42B): {getTimeOnAir().toFixed(0)}ms</span>
                </Column>
                <Column>
                  <Button onclick={saveConfig} disabled={!getReady()} style={{ width: "100%" }}>Configure</Button>
                </Column>
              </Column.Row>
            </Form.Group>
          </Section>

          <Section size="xl" marginY>
            <Column.Row>
              <Column xxl={7}>
                <span>Battery: {getBattery()}%</span>
              </Column>
              <Column>
                <Button onclick={() => LoRa.send({ type: "toggle-screen" })} disabled={!getReady()} style={{ width: "100%" }}>Toggle Display</Button>
              </Column>
            </Column.Row>
          </Section>

          <Section size="xl" marginY>
            <Column.Row>
              <Column xxl={7}>
                <span>Distance to Home: {getDistance().toFixed(0)}m</span>
              </Column>
              <Column>
                <Button onclick={setHomeToCurrentLocation} style={{ width: "100%" }}>Set Home</Button>
              </Column>
            </Column.Row>
          </Section>

          <div>
            <img src={compass_ring_svg} style={{ position: "absolute", "max-width": "100px" }} />
            <img src={compass_arrow_svg} style={{ position: "absolute", "max-width": "100px", transform: `rotate(${getCompass()}deg)` }} />
            <img src={compass_marker_svg} style={{ position: "absolute", "max-width": "100px", transform: `rotate(${getBearing()}deg)` }} />
          </div>

          <Section size="xl" marginY style={{ "flex-grow": 1 }} />

          <Section size="xl" marginY>
            <Column.Row>
              <Column>
                <h4>TX</h4>
                <div>rssi: {getSignalStrength().tx.rssi} dBm</div>
                <div>snr: {getSignalStrength().tx.snr} S/N</div>
                <div>ferr: {getSignalStrength().tx.ferr} Hz</div>
              </Column>
              <Column>
                <h4>RX</h4>
                <div>rssi: {getSignalStrength().rx.rssi} dBm</div>
                <div>snr: {getSignalStrength().rx.snr} S/N</div>
                <div>ferr: {getSignalStrength().rx.ferr} Hz</div>
              </Column>
            </Column.Row>
          </Section>

          <Section size="xl" marginY>
            <Navbar size="lg">
              <Navbar.Section>
                <Button onclick={exportStoredData}>Export Data</Button>
              </Navbar.Section>
              <Navbar.Section>
                <Button onclick={ping} style={{ "width": "100%" }} loading={!getReady()}><Icon src={iconRadio} /> Ping</Button>
              </Navbar.Section>
            </Navbar>
            <pre>{getLogMessage()}</pre>
          </Section>
        </Tabs.Panel>

        <Tabs.Panel id="chat" header={<A><Icon src={iconMessageSquare} /> Chat</A>}>
          <Section id="chat-window" size="xl" marginY style={{ "flex-grow": 1, "overflow-y": "auto", "margin-bottom": 0 }}>
            <For each={getChat()}>
              {message => {
                const MessageColumn: Component<{ outbound?: boolean }> = props => {
                  const visible = (!!message.outbound === !!props.outbound)
                  return (
                    <Column xxl={visible ? 10 : 2} class="chat-message" {...badge(visible ? `by ${message.source} at ${timeFormat.format(message.date)}` : undefined)}>
                      <Show when={visible}>
                        <Toast>{message.text}</Toast>
                      </Show>
                    </Column>
                  )
                }
                return (
                  <Column.Row>
                    <MessageColumn />
                    <MessageColumn outbound />
                  </Column.Row>
                )
              }}
            </For>
          </Section>

          <Section size="xl" marginY>
            <span style={{ "display": "flex", "flex-direction": "row" }}>
              <Input value={getOutbound()} oninput={ev => setOutbound(ev.currentTarget.value)} style={{ "flex-grow": 1 }} />
              <Button onclick={send} loading={!getReady()}><Icon src={iconSend} /></Button>
            </span>
            <p>Estimated transmission time: ~{getOutboundTimeOnAir().toFixed(0)}ms</p>
            <pre>{getLogMessage()}</pre>
          </Section>
        </Tabs.Panel>
      </Tabs>
    </>
  )
}

export default HomeView
