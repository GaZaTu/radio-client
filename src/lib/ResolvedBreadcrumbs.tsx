import { A } from "@gazatu/solid-spectre/ui/A"
import { Breadcrumbs } from "@gazatu/solid-spectre/ui/Breadcrumbs"
import { Title } from "@solidjs/meta"
import { Component, For, Show, createMemo } from "solid-js"
import { createResolvedRoutePath } from "../routes"

type Props = {
  fallback?: string
  params?: Record<string, string>
}

const ResolvedBreadcrumbs: Component<Props> = props => {
  const resolvedRoutePath = createResolvedRoutePath(() => props.params ?? {})
  const filteredRoutePath = createMemo(() => {
    return resolvedRoutePath()
      .filter(r => (r.data as any)?.title)
  })

  return (
    <Breadcrumbs style={{ margin: "0", padding: "0" }}>
      <For each={filteredRoutePath()} fallback={
        <span>
          <Title>{props.fallback}</Title>
          <h3 style={{ display: "inline-block" }}>{props.fallback}</h3>
        </span>
      }>
        {r => {
          const title = (r.data as any)?.title

          return (
            <Show when={r.active} fallback={
              <A href={r.pathname}>{title}</A>
            }>
              <span>
                <Title>{title}</Title>
                <h3 style={{ display: "inline-block" }}>{title}</h3>
              </span>
            </Show>
          )
        }}
      </For>
    </Breadcrumbs>
  )
}

export default ResolvedBreadcrumbs
