import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"

import { getAuthHeaders } from "./cookies"
import { createServerFn } from "@tanstack/react-start"

export const retrieveVariant = createServerFn({ method: "GET" })
  .validator((variant_id: string) => variant_id)
  .handler(async ({ data: variant_id }) => {
    const authHeaders = await getAuthHeaders()

    if (!authHeaders) return null

    const headers = {
      ...authHeaders,
    }

    return sdk.client
      .fetch<{ variant: HttpTypes.StoreProductVariant }>(
        `/store/product-variants/${variant_id}`,
        {
          method: "GET",
          query: {
            fields: "*images",
          },
          headers,
        }
      )
      .then(({ variant }) => variant)
      .catch(() => null)
  })
