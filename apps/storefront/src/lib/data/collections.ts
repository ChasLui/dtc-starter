import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { createServerFn } from "@tanstack/react-start"

export const retrieveCollection = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    return sdk.client
      .fetch<{ collection: HttpTypes.StoreCollection }>(
        `/store/collections/${id}`,
        {
          method: "GET",
        }
      )
      .then(({ collection }) => collection)
  })

export const listCollections = createServerFn({ method: "GET" })
  .validator((queryParams: Record<string, string> = {}) => queryParams)
  .handler(
    async ({
      data: queryParams,
    }): Promise<{ collections: HttpTypes.StoreCollection[]; count: number }> => {
      queryParams.limit = queryParams.limit || "100"
      queryParams.offset = queryParams.offset || "0"

      return sdk.client
        .fetch<{ collections: HttpTypes.StoreCollection[]; count: number }>(
          "/store/collections",
          {
            query: queryParams,
          }
        )
        .then(({ collections }) => ({ collections, count: collections.length }))
    }
  )

export const getCollectionByHandle = createServerFn({ method: "GET" })
  .validator((handle: string) => handle)
  .handler(async ({ data: handle }) => {
    return sdk.client
      .fetch<HttpTypes.StoreCollectionListResponse>(`/store/collections`, {
        query: { handle, fields: "*products" },
      })
      .then(({ collections }) => collections[0] || null)
  })
