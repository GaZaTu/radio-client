import { Accessor, createEffect, createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import { isServer } from "solid-js/web"
import fetchFromApi from "./fetchFromApi"

const [graphqlEndpoint, setGraphqlEndpoint] = createSignal<string>("")

export {
  graphqlEndpoint,
  setGraphqlEndpoint,
}

type GraphQLOptions = {
  query: string
  variables?: Record<string, unknown>
}

type GraphQLResult<T = any> = {
  errors?: { message?: string, stack?: string }[]
  data: T | null
  extensions?: Record<string, unknown>
}

class GraphQLError extends Error { }

const fetchGraphQL = async<T>(options: GraphQLOptions) => {
  const response = await fetchFromApi(graphqlEndpoint(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/graphql-response+json, application/json",
    },
    body: JSON.stringify({
      query: options.query,
      variables: options.variables,
    }),
  })

  const json = await response.json() as GraphQLResult<T> | undefined

  const firstError = json?.errors?.[0]
  if (firstError) {
    throw new GraphQLError(firstError.stack ?? firstError.message)
  }

  if (!response.ok) {
    throw new GraphQLError(response.statusText)
  }

  if (!json?.data) {
    throw new GraphQLError("Unexpected")
  }

  return json.data
}

export default fetchGraphQL

// const createGraphQLResource = createGraphQLClient(graphqlEndpoint, {}, fetchFromApi)

export const gql = (query: TemplateStringsArray) =>
  query
    .join(" ")
    .replace(/#.+\r?\n|\r/g, "")
    .replace(/\r?\n|\r/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()

type GraphQLResourceOptions<T, I extends T = T> = Omit<GraphQLOptions, "variables"> & {
  initialValue?: I
  onError?: (error: Error) => void
  variables?: Record<string, unknown> | Accessor<Record<string, unknown> | undefined>
  infinite?: (prev: T | undefined, next: T) => T
}

const createGraphQLResource = <T>(options: GraphQLResourceOptions<T>) => {
  const [state, setState] = createStore({
    loading: isServer,
    data: undefined as T | undefined,
    error: undefined as Error | undefined,
  })

  const [refresh, setRefresh] = createSignal(false)

  createEffect((previousEffect?: { cancelled: boolean, stringifiedVariables: string }) => {
    if (refresh()) {
      setRefresh(false)
      return undefined
    }

    const query = options.query
    const variables = (() => {
      if (typeof options.variables === "function") {
        return options.variables()
      } else {
        return options.variables
      }
    })()

    if (!variables || isServer) {
      return undefined
    }

    const stringifiedVariables = JSON.stringify(variables)
    if (stringifiedVariables === previousEffect?.stringifiedVariables) {
      return undefined
    }

    const effect = {
      cancelled: false,
      stringifiedVariables,
    }

    setState(state => ({
      ...state,
      loading: true,
    }))

    if (previousEffect) {
      previousEffect.cancelled = true
    }

    void (async () => {
      let data: typeof state.data = undefined
      let error: typeof state.error = undefined

      try {
        data = await fetchGraphQL<T>({ query, variables })
      } catch (e: any) {
        console.warn("GraphQL error", e)
        error = e
      } finally {
        if (!effect.cancelled) {
          setState(state => ({
            ...state,
            loading: false,
            data: (data && options.infinite) ? options.infinite(state.data, data) : data,
            error,
          }))
        }
      }
    })()

    return effect
  })

  createEffect(() => {
    if (!state.error) {
      return
    }

    options.onError?.(state.error)
  })

  return {
    get loading() {
      return state.loading
    },
    get data() {
      return state.data
    },
    get error() {
      return state.error
    },
    refresh() {
      setRefresh(true)
    },
    clear() {
      setState({
        loading: false,
        data: undefined,
        error: undefined,
      })
    },
  }
}

export {
  createGraphQLResource,
}
