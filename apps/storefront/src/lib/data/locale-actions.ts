import { sdk } from "@lib/config"
import { createServerFn } from "@tanstack/react-start"
import { getCookie, setCookie } from "@tanstack/react-start/server"
import { getAuthHeaders, getCartId } from "./cookies"

const LOCALE_COOKIE_NAME = "_medusa_locale"

/**
 * Gets the current locale from cookies
 */
export const getLocale = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return getCookie(LOCALE_COOKIE_NAME) ?? null
  } catch {
    return null
  }
})

/**
 * Sets the locale cookie
 */
export const setLocaleCookie = createServerFn({ method: "POST" })
  .validator((locale: string) => locale)
  .handler(async ({ data: locale }) => {
    setCookie(LOCALE_COOKIE_NAME, locale, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      httpOnly: false, // Allow client-side access
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    })

    return locale
  })

/**
 * Updates the locale preference via SDK and stores in cookie.
 * Also updates the cart with the new locale if one exists.
 */
export const updateLocale = createServerFn({ method: "POST" })
  .validator((localeCode: string) => localeCode)
  .handler(async ({ data: localeCode }) => {
    await setLocaleCookie({ data: localeCode })

    // Update cart with the new locale if a cart exists
    const cartId = await getCartId()
    if (cartId) {
      const headers = {
        ...(await getAuthHeaders()),
      }

      await sdk.store.cart.update(cartId, { locale: localeCode }, {}, headers)
    }

    return localeCode
  })
