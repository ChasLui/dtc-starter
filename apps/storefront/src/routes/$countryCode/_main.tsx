import { Outlet, createFileRoute } from "@tanstack/react-router"

import { useStorefront } from "@lib/context/storefront-context"
import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge"

export const Route = createFileRoute("/$countryCode/_main")({
  component: MainLayout,
})

function MainLayout() {
  const { customer, cart, shippingOptions } = useStorefront()

  return (
    <>
      <Nav />
      {customer && cart && (
        <CartMismatchBanner customer={customer} cart={cart} />
      )}

      {cart && (
        <FreeShippingPriceNudge
          variant="popup"
          cart={cart}
          shippingOptions={shippingOptions}
        />
      )}
      <Outlet />
      <Footer />
    </>
  )
}
