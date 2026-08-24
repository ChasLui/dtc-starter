import { HttpTypes } from "@medusajs/types"
import Addresses from "@modules/checkout/components/addresses"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"
import Shipping from "@modules/checkout/components/shipping"

export default function CheckoutForm({
  cart,
  customer,
  shippingMethods,
  paymentMethods,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  shippingMethods: HttpTypes.StoreCartShippingOption[] | null
  paymentMethods: { id: string }[] | null
}) {
  if (!cart) {
    return null
  }

  if (!shippingMethods || !paymentMethods) {
    return null
  }

  return (
    <div className="w-full grid grid-cols-1 gap-y-8">
      <Addresses cart={cart} customer={customer} />

      <Shipping cart={cart} availableShippingMethods={shippingMethods} />

      <Payment cart={cart} availablePaymentMethods={paymentMethods} />

      <Review cart={cart} />
    </div>
  )
}
