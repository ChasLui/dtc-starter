import { sdk } from "@lib/config"
import { getAuthHeaders } from "./cookies"
import { HttpTypes } from "@medusajs/types"
import { createServerFn } from "@tanstack/react-start"

export const listCartPaymentMethods = createServerFn({ method: "GET" })
  .validator((regionId: string) => regionId)
  .handler(async ({ data: regionId }) => {
    const headers = {
      ...(await getAuthHeaders()),
    }

    return sdk.client
      .fetch<HttpTypes.StorePaymentProviderListResponse>(
        `/store/payment-providers`,
        {
          method: "GET",
          query: { region_id: regionId },
          headers,
        },
      )
      .then(({ payment_providers }) =>
        payment_providers.sort((a, b) => {
          return a.id > b.id ? 1 : -1
        }),
      )
      .catch(() => {
        return null
      })
  })
