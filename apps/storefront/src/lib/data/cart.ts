import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { createServerFn } from "@tanstack/react-start"
import { redirect } from "@tanstack/react-router"
import {
  getAuthHeaders,
  getCartId,
  removeCartId,
  setCartId,
} from "./cookies"
import { getRegion } from "./regions"
import { getLocale } from "./locale-actions"

/**
 * Retrieves a cart by its ID. If no ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to retrieve.
 * @returns The cart object if found, or null if not found.
 */
export const retrieveCart = createServerFn({ method: "GET" })
  .validator((d: { cartId?: string; fields?: string }) => d)
  .handler(async ({ data }) => {
    const id = data.cartId || (await getCartId())
    const fields =
      data.fields ??
      "*items, *region, *items.product, *items.variant, *items.thumbnail, *items.metadata, +items.total, *promotions, +shipping_methods.name"

    if (!id) {
      return null
    }

    const headers = {
      ...(await getAuthHeaders()),
    }

    return sdk.client
      .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
        method: "GET",
        query: {
          fields,
        },
        headers,
      })
      .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)
      .catch(() => null)
  })

export const getOrSetCart = createServerFn({ method: "GET" })
  .validator((countryCode: string) => countryCode)
  .handler(async ({ data: countryCode }) => {
    const region = await getRegion({ data: countryCode })

    if (!region) {
      throw new Error(`Region not found for country code: ${countryCode}`)
    }

    let cart = await retrieveCart({
      data: { cartId: undefined, fields: "id,region_id" },
    })

    const headers = {
      ...(await getAuthHeaders()),
    }

    if (!cart) {
      const locale = await getLocale()
      const cartResp = await sdk.store.cart.create(
        { region_id: region.id, locale: locale || undefined },
        {},
        headers
      )
      cart = cartResp.cart

      await setCartId(cart.id)
    }

    if (cart && cart?.region_id !== region.id) {
      await sdk.store.cart.update(cart.id, { region_id: region.id }, {}, headers)
    }

    return cart
  })

export const updateCart = createServerFn({ method: "POST" })
  .validator((data: HttpTypes.StoreUpdateCart) => data)
  .handler(async ({ data }) => {
    const cartId = await getCartId()

    if (!cartId) {
      throw new Error("No existing cart found, please create one before updating")
    }

    const headers = {
      ...(await getAuthHeaders()),
    }

    return sdk.store.cart
      .update(cartId, data, {}, headers)
      .then(({ cart }: { cart: HttpTypes.StoreCart }) => cart)
      .catch(medusaError)
  })

export const addToCart = createServerFn({ method: "POST" })
  .validator(
    (d: { variantId: string; quantity: number; countryCode: string }) => d
  )
  .handler(async ({ data: { variantId, quantity, countryCode } }) => {
    if (!variantId) {
      throw new Error("Missing variant ID when adding to cart")
    }

    const cart = await getOrSetCart({ data: countryCode })

    if (!cart) {
      throw new Error("Error retrieving or creating cart")
    }

    const headers = {
      ...(await getAuthHeaders()),
    }

    await sdk.store.cart.createLineItem(
      cart.id,
      {
        variant_id: variantId,
        quantity,
      },
      {},
      headers
    )

    return { success: true }
  })

export const updateLineItem = createServerFn({ method: "POST" })
  .validator((d: { lineId: string; quantity: number }) => d)
  .handler(async ({ data: { lineId, quantity } }) => {
    if (!lineId) {
      throw new Error("Missing lineItem ID when updating line item")
    }

    const cartId = await getCartId()

    if (!cartId) {
      throw new Error("Missing cart ID when updating line item")
    }

    const headers = {
      ...(await getAuthHeaders()),
    }

    await sdk.store.cart.updateLineItem(cartId, lineId, { quantity }, {}, headers)

    return { success: true }
  })

export const deleteLineItem = createServerFn({ method: "POST" })
  .validator((lineId: string) => lineId)
  .handler(async ({ data: lineId }) => {
    if (!lineId) {
      throw new Error("Missing lineItem ID when deleting line item")
    }

    const cartId = await getCartId()

    if (!cartId) {
      throw new Error("Missing cart ID when deleting line item")
    }

    const headers = {
      ...(await getAuthHeaders()),
    }

    await sdk.store.cart.deleteLineItem(cartId, lineId, {}, headers)

    return { success: true }
  })

export const setShippingMethod = createServerFn({ method: "POST" })
  .validator((d: { cartId: string; shippingMethodId: string }) => d)
  .handler(async ({ data: { cartId, shippingMethodId } }) => {
    const headers = {
      ...(await getAuthHeaders()),
    }

    return sdk.store.cart
      .addShippingMethod(cartId, { option_id: shippingMethodId }, {}, headers)
      .then(() => ({ success: true }))
      .catch(medusaError)
  })

export const initiatePaymentSession = createServerFn({ method: "POST" })
  .validator(
    (d: {
      cart: HttpTypes.StoreCart
      data: HttpTypes.StoreInitializePaymentSession
    }) => d
  )
  .handler(async ({ data: { cart, data } }) => {
    const headers = {
      ...(await getAuthHeaders()),
    }

    return sdk.store.payment
      .initiatePaymentSession(cart, data, {}, headers)
      .then((resp) => resp)
      .catch(medusaError)
  })

export const applyPromotions = createServerFn({ method: "POST" })
  .validator((codes: string[]) => codes)
  .handler(async ({ data: codes }) => {
    const cartId = await getCartId()

    if (!cartId) {
      throw new Error("No existing cart found")
    }

    const headers = {
      ...(await getAuthHeaders()),
    }

    return sdk.store.cart
      .update(cartId, { promo_codes: codes }, {}, headers)
      .then(() => ({ success: true }))
      .catch(medusaError)
  })

export const submitPromotionForm = createServerFn({ method: "POST" })
  .validator((formData: FormData) => formData)
  .handler(async ({ data: formData }) => {
    const code = formData.get("code") as string
    try {
      await applyPromotions({ data: [code] })
      return null
    } catch (e: any) {
      return e.message
    }
  })

// TODO: Pass a POJO instead of a form entity here
export const setAddresses = createServerFn({ method: "POST" })
  .validator((formData: FormData) => formData)
  .handler(async ({ data: formData }) => {
    try {
      if (!formData) {
        throw new Error("No form data found when setting addresses")
      }
      const cartId = await getCartId()
      if (!cartId) {
        throw new Error("No existing cart found when setting addresses")
      }

      const data = {
        shipping_address: {
          first_name: formData.get("shipping_address.first_name"),
          last_name: formData.get("shipping_address.last_name"),
          address_1: formData.get("shipping_address.address_1"),
          address_2: "",
          company: formData.get("shipping_address.company"),
          postal_code: formData.get("shipping_address.postal_code"),
          city: formData.get("shipping_address.city"),
          country_code: formData.get("shipping_address.country_code"),
          province: formData.get("shipping_address.province"),
          phone: formData.get("shipping_address.phone"),
        },
        email: formData.get("email"),
      } as any

      const sameAsBilling = formData.get("same_as_billing")
      if (sameAsBilling === "on") data.billing_address = data.shipping_address

      if (sameAsBilling !== "on")
        data.billing_address = {
          first_name: formData.get("billing_address.first_name"),
          last_name: formData.get("billing_address.last_name"),
          address_1: formData.get("billing_address.address_1"),
          address_2: "",
          company: formData.get("billing_address.company"),
          postal_code: formData.get("billing_address.postal_code"),
          city: formData.get("billing_address.city"),
          country_code: formData.get("billing_address.country_code"),
          province: formData.get("billing_address.province"),
          phone: formData.get("billing_address.phone"),
        }
      await updateCart({ data })
    } catch (e: any) {
      return e.message
    }

    throw redirect({
      href: `/${formData.get("shipping_address.country_code")}/checkout?step=delivery`,
    })
  })

/**
 * Places an order for a cart. If no cart ID is provided, it will use the cart ID from the cookies.
 * @param cartId - optional - The ID of the cart to place an order for.
 * @returns The cart object if the order was successful, or null if not.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .validator((cartId?: string) => cartId ?? "")
  .handler(async ({ data: id }) => {
    const cartId = id || (await getCartId())

    if (!cartId) {
      throw new Error("No existing cart found when placing an order")
    }

    const headers = {
      ...(await getAuthHeaders()),
    }

    const cartRes = await sdk.store.cart
      .complete(cartId, {}, headers)
      .catch(medusaError)

    if (cartRes?.type === "order") {
      const countryCode =
        cartRes.order.shipping_address?.country_code?.toLowerCase()

      removeCartId()

      throw redirect({
        to: "/$countryCode/order/$id/confirmed",
        params: { countryCode: countryCode ?? "dk", id: cartRes.order.id },
      })
    }

    return cartRes.cart
  })

/**
 * Updates the countrycode param and revalidates the regions cache
 * @param regionId
 * @param countryCode
 */
export const updateRegion = createServerFn({ method: "POST" })
  .validator((d: { countryCode: string; currentPath: string }) => d)
  .handler(async ({ data: { countryCode, currentPath } }) => {
    const cartId = await getCartId()
    const region = await getRegion({ data: countryCode })

    if (!region) {
      throw new Error(`Region not found for country code: ${countryCode}`)
    }

    if (cartId) {
      await updateCart({ data: { region_id: region.id } })
    }

    throw redirect({
      href: `/${countryCode}${currentPath}`,
    })
  })

export const listCartOptions = createServerFn({ method: "GET" }).handler(
  async () => {
    const cartId = await getCartId()
    const headers = {
      ...(await getAuthHeaders()),
    }

    return sdk.client.fetch<{
      shipping_options: HttpTypes.StoreCartShippingOption[]
    }>("/store/shipping-options", {
      query: { cart_id: cartId },
      headers,
    })
  }
)
