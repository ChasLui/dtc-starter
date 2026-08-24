import { useStorefront } from "@lib/context/storefront-context"
import CartDropdown from "../cart-dropdown"

export default function CartButton() {
  const { cart } = useStorefront()

  return <CartDropdown cart={cart} />
}
