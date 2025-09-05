import { AnchorContext } from "@gazatu/solid-spectre/ui/A.Context"
import { Icon } from "@gazatu/solid-spectre/ui/Icon"
import { ModalPortal } from "@gazatu/solid-spectre/ui/Modal.Portal"
import { Toaster } from "@gazatu/solid-spectre/ui/Toaster"
import { FeatherIconProvider } from "@gazatu/solid-spectre/util/FeatherIconProvider"
import { useColorSchemeEffect } from "@gazatu/solid-spectre/util/colorScheme"
import { MetaProvider, Title } from "@solidjs/meta"
import { Router, useLocation, useNavigate } from "@solidjs/router"
import { Component, ErrorBoundary } from "solid-js"
import AppFooter from "./AppFooter"
import AppHeader from "./AppHeader"
import AppMain from "./AppMain"
import { setDefaultFetchInfo } from "./lib/fetchFromApi"
import { setGraphqlEndpoint } from "./lib/fetchGraphQL"

Icon.registerProvider(FeatherIconProvider)

AnchorContext.useLocation = useLocation
AnchorContext.useNavigate = useNavigate

setDefaultFetchInfo(import.meta.env.VITE_API_URL)
setGraphqlEndpoint("/graphql")

type Props = {
  url?: string
}

const App: Component<Props> = props => {
  useColorSchemeEffect()

  return (
    <Router url={props.url}>
      <MetaProvider>
        <Title>radio-client</Title>

        {/* <AppHeader /> */}

        <ErrorBoundary fallback={Toaster.pushError}>
          <AppMain />
        </ErrorBoundary>

        <AppFooter />

        <ModalPortal />
        <Toaster />
      </MetaProvider>
    </Router>
  )
}

export default App
