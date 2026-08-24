import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/_checkout/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    step:
      typeof search.step === "string" &&
      ["address", "delivery", "payment", "review"].includes(search.step)
        ? search.step
        : "address",
  }),
  loader: async () => {
    const cart = await retrieveCart({ data: {} })

    if (!cart) {
      throw notFound()
    }

    const [customer, shippingMethods, paymentMethods] = await Promise.all([
      retrieveCustomer(),
      listCartShippingMethods({ data: cart.id }),
      listCartPaymentMethods({ data: cart.region?.id ?? "" }),
    ])

    return { cart, customer, shippingMethods, paymentMethods }
  },
  head: () => ({
    meta: [{ title: "Checkout" }],
  }),
  component: CheckoutPage,
})

function CheckoutPage() {
  const { cart, customer, shippingMethods, paymentMethods } =
    Route.useLoaderData()

  if (!shippingMethods || !paymentMethods) {
    return null
  }

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      <PaymentWrapper cart={cart}>
        <CheckoutForm
          cart={cart}
          customer={customer}
          shippingMethods={shippingMethods}
          paymentMethods={paymentMethods}
        />
      </PaymentWrapper>
      <CheckoutSummary cart={cart} />
    </div>
  )
}
