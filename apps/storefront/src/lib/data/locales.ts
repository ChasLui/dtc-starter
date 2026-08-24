import { sdk } from "@lib/config"
import { createServerFn } from "@tanstack/react-start"

export type Locale = {
  code: string
  name: string
}

/**
 * Fetches available locales from the backend.
 * Returns null if the endpoint returns 404 (locales not configured).
 */
export const listLocales = createServerFn({ method: "GET" }).handler(
  async (): Promise<Locale[] | null> => {
    return sdk.client
      .fetch<{ locales: Locale[] }>(`/store/locales`, {
        method: "GET",
      })
      .then(({ locales }) => locales)
      .catch(() => null)
  },
)
