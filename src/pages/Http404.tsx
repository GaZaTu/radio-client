import { Empty } from "@gazatu/solid-spectre/ui/Empty"
import { Component } from "solid-js"

const Http404View: Component = () => {
  return (
    <Empty>
      <Empty.Header>
        <h1>404</h1>
        <h2>¯\\_(ツ)_/¯</h2>
      </Empty.Header>
    </Empty>
  )
}

export default Http404View
