import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { getAuthHeaders } from "./cookies"
import { HttpTypes } from "@medusajs/types"
import { createServerFn } from "@tanstack/react-start"

export const retrieveOrder = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const headers = {
      ...(await getAuthHeaders()),
    }

    return sdk.client
      .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
        method: "GET",
        query: {
          fields:
            "*payment_collections.payments,*items,*items.metadata,*items.variant,*items.product",
        },
        headers,
      })
      .then(({ order }) => order)
      .catch((err) => medusaError(err))
  })

export const listOrders = createServerFn({ method: "GET" })
  .validator(
    (d: { limit?: number; offset?: number; filters?: Record<string, unknown> }) =>
      d
  )
  .handler(
    async ({ data: { limit = 10, offset = 0, filters } }) => {
      const headers = {
        ...(await getAuthHeaders()),
      }

      return sdk.client
        .fetch<HttpTypes.StoreOrderListResponse>(`/store/orders`, {
          method: "GET",
          query: {
            limit,
            offset,
            order: "-created_at",
            fields: "*items,+items.metadata,*items.variant,*items.product",
            ...filters,
          },
          headers,
        })
        .then(({ orders }) => orders)
        .catch((err) => medusaError(err))
    }
  )

export const createTransferRequest = createServerFn({ method: "POST" })
  .validator((formData: FormData) => formData)
  .handler(async ({ data: formData }) => {
    const id = formData.get("order_id") as string

    if (!id) {
      return { success: false, error: "Order ID is required", order: null }
    }

    const headers = await getAuthHeaders()

    return sdk.store.order
      .requestTransfer(
        id,
        {},
        {
          fields: "id, email",
        },
        headers
      )
      .then(({ order }) => ({ success: true, error: null, order }))
      .catch((err) => ({ success: false, error: err.message, order: null }))
  })

export const acceptTransferRequest = createServerFn({ method: "POST" })
  .validator((d: { id: string; token: string }) => d)
  .handler(async ({ data: { id, token } }) => {
    const headers = await getAuthHeaders()

    return sdk.store.order
      .acceptTransfer(id, { token }, {}, headers)
      .then(({ order }) => ({ success: true, error: null, order }))
      .catch((err) => ({ success: false, error: err.message, order: null }))
  })

export const declineTransferRequest = createServerFn({ method: "POST" })
  .validator((d: { id: string; token: string }) => d)
  .handler(async ({ data: { id, token } }) => {
    const headers = await getAuthHeaders()

    return sdk.store.order
      .declineTransfer(id, { token }, {}, headers)
      .then(({ order }) => ({ success: true, error: null, order }))
      .catch((err) => ({ success: false, error: err.message, order: null }))
  })
