import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import CartTemplate from "@modules/cart/templates"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/_main/cart")({
  loader: async () => {
    const cart = await retrieveCart({ data: {} }).catch((error) => {
      console.error(error)
      throw notFound()
    })

    const customer = await retrieveCustomer()

    return { cart, customer }
  },
  head: () => ({
    meta: [
      { title: "Cart" },
      { name: "description", content: "View your cart" },
    ],
  }),
  component: CartPage,
})

function CartPage() {
  const { cart, customer } = Route.useLoaderData()

  return <CartTemplate cart={cart} customer={customer} />
}
