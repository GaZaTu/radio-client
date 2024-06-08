import { RouteDefinition, useLocation, useParams } from "@solidjs/router"
import { Accessor, createMemo, lazy, mergeProps } from "solid-js"

const routes: RouteDefinition[] = [
  {
    path: "/",
    component: lazy(() => import("./pages/Home")),
  },
  {
    path: "**",
    component: lazy(() => import("./pages/Http404")),
  },
]

export default routes

export const createResolvedRoutePath = (suppliedParams: Accessor<Record<string, string>>) => {
  const location = useLocation()
  const locationParams = useParams()
  const params = createMemo(() => {
    return mergeProps(locationParams, suppliedParams())
  })

  const resolvedRoutePath = createMemo(() => {
    const dirname = (path: string) => {
      return path.slice(0, path.lastIndexOf("/"))
    }

    const resolvedLocationPath = [] as { pathname: string, routePath: string, data: unknown, active: boolean }[]

    const _params = params()

    let routePath = location.pathname
    for (const [k, v] of Object.entries(_params)) {
      routePath = routePath.replace(v, `:${k}`)
    }

    while (routePath) {
      for (const route of routes) {
        if (route.path === routePath) {
          const pathname = (() => {
            let pathname = route.path
            for (const [k, v] of Object.entries(_params)) {
              pathname = pathname.replace(`:${k}`, v)
            }
            return pathname
          })()
          const data = route.data?.({ data: {}, location, params: _params, navigate: undefined as any })
          const active = !resolvedLocationPath.length

          resolvedLocationPath.unshift({ pathname, routePath, data, active })
          break
        }
      }

      routePath = dirname(routePath)
    }

    return resolvedLocationPath
  })

  return resolvedRoutePath
}
