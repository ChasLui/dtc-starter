import { StorefrontProvider } from "@lib/context/storefront-context"
import { listCategories } from "@lib/data/categories"
import { listCartOptions, retrieveCart } from "@lib/data/cart"
import { listCollections } from "@lib/data/collections"
import { retrieveCustomer } from "@lib/data/customer"
import { getLocale } from "@lib/data/locale-actions"
import { listLocales } from "@lib/data/locales"
import { getCountryCode, getRegion, listRegions } from "@lib/data/regions"
import {
  Outlet,
  createFileRoute,
  notFound,
  redirect,
} from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode")({
  beforeLoad: async ({ params }) => {
    const region = await getRegion({ data: params.countryCode })

    if (!region) {
      const countryCode = await getCountryCode()

      if (countryCode !== params.countryCode) {
        throw redirect({
          to: "/$countryCode",
          params: { countryCode },
          replace: true,
        })
      }

      throw notFound()
    }
  },
  loader: async ({ params }) => {
    const countryCode = params.countryCode

    const [
      customer,
      cart,
      regions,
      locales,
      currentLocale,
      categories,
      collections,
      region,
    ] = await Promise.all([
      retrieveCustomer(),
      retrieveCart({ data: {} }),
      listRegions(),
      listLocales(),
      getLocale(),
      listCategories(),
      listCollections({ data: { fields: "id, handle, title" } }),
      getRegion({ data: countryCode }),
    ])

    let shippingOptions: Awaited<
      ReturnType<typeof listCartOptions>
    >["shipping_options"] = []

    if (cart) {
      const resp = await listCartOptions()
      shippingOptions = resp.shipping_options
    }

    return {
      countryCode,
      customer,
      cart,
      regions,
      locales,
      currentLocale,
      categories,
      collections: collections.collections,
      shippingOptions,
      region,
    }
  },
  component: CountryLayout,
})

function CountryLayout() {
  const data = Route.useLoaderData()

  return (
    <StorefrontProvider data={data}>
      <Outlet />
    </StorefrontProvider>
  )
}
