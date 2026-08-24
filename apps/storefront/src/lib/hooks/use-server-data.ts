import { useEffect, useState } from "react"

/**
 * Runs a server function on the client after mount and exposes its result.
 * A lightweight replacement for server components fetching in the browser.
 */
export function useServerData<T>(fetcher: () => Promise<T>): {
  data: T | null
  error: unknown
  isLoading: boolean
} {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetcher()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // oxlint-disable-next-line react/exhaustive-deps
  }, [])

  return { data, error, isLoading }
}
