import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders } from "./cookies"
import { createServerFn } from "@tanstack/react-start"

export const listCartShippingMethods = createServerFn({ method: "GET" })
  .validator((cartId: string) => cartId)
  .handler(async ({ data: cartId }) => {
    const headers = {
      ...(await getAuthHeaders()),
    }

    return sdk.client
      .fetch<HttpTypes.StoreShippingOptionListResponse>(
        `/store/shipping-options`,
        {
          method: "GET",
          query: {
            cart_id: cartId,
          },
          headers,
        },
      )
      .then(({ shipping_options }) => shipping_options)
      .catch(() => {
        return null
      })
  })

export const calculatePriceForShippingOption = createServerFn({
  method: "POST",
})
  .validator(
    (d: { optionId: string; cartId: string; data?: Record<string, unknown> }) =>
      d,
  )
  .handler(async ({ data: { optionId, cartId, data } }) => {
    const headers = {
      ...(await getAuthHeaders()),
    }

    const body: Record<string, unknown> = { cart_id: cartId, data }

    if (data) {
      body.data = data
    }

    return sdk.client
      .fetch<{ shipping_option: HttpTypes.StoreCartShippingOption }>(
        `/store/shipping-options/${optionId}/calculate`,
        {
          method: "POST",
          body,
          headers,
        },
      )
      .then(({ shipping_option }) => shipping_option)
      .catch((_e) => {
        return null
      })
  })
