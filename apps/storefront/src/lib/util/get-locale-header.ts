import { getLocale } from "@lib/data/locale-actions"

export async function getLocaleHeader() {
  let locale: string | null = null

  if (typeof window === "undefined") {
    locale = await getLocale()
  } else {
    locale =
      document.cookie.match(/(?:^|; )_medusa_locale=([^;]*)/)?.[1] ?? null
  }

  return {
    "x-medusa-locale": locale ?? "",
  } as const
}
