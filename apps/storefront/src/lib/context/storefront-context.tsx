import { HttpTypes } from "@medusajs/types"
import { Locale } from "@lib/data/locales"
import { createContext, useContext } from "react"
import { useRouter } from "@tanstack/react-router"

export type StorefrontData = {
  countryCode: string
  regions: HttpTypes.StoreRegion[]
  locales: Locale[] | null
  currentLocale: string | null
  customer: HttpTypes.StoreCustomer | null
  cart: HttpTypes.StoreCart | null
  shippingOptions: HttpTypes.StoreCartShippingOption[]
  categories: HttpTypes.StoreProductCategory[]
  collections: HttpTypes.StoreCollection[]
  region: HttpTypes.StoreRegion | null
}

type StorefrontContextValue = StorefrontData & {
  refresh: () => Promise<void>
}

const StorefrontContext = createContext<StorefrontContextValue | null>(null)

export function StorefrontProvider({
  data,
  children,
}: {
  data: StorefrontData
  children: React.ReactNode
}) {
  const router = useRouter()

  const refresh = async () => {
    await router.invalidate()
  }

  return (
    <StorefrontContext.Provider value={{ ...data, refresh }}>
      {children}
    </StorefrontContext.Provider>
  )
}

export function useStorefront(): StorefrontContextValue {
  const ctx = useContext(StorefrontContext)

  if (!ctx) {
    throw new Error("useStorefront must be used within a StorefrontProvider")
  }

  return ctx
}
