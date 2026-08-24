import { retrieveCustomer } from "@lib/data/customer"
import { getRegion } from "@lib/data/regions"
import AddressBook from "@modules/account/components/address-book"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/_main/account/addresses")({
  loader: async ({ params }) => {
    const customer = await retrieveCustomer()
    const region = await getRegion({ data: params.countryCode })

    if (!customer || !region) {
      throw notFound()
    }

    return { customer, region }
  },
  head: () => ({
    meta: [
      { title: "Addresses" },
      { name: "description", content: "View your addresses" },
    ],
  }),
  component: AddressesPage,
})

function AddressesPage() {
  const { customer, region } = Route.useLoaderData()

  return (
    <div className="w-full" data-testid="addresses-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Shipping Addresses</h1>
        <p className="text-base-regular">
          View and update your shipping addresses, you can add as many as you
          like. Saving your addresses will make them available during checkout.
        </p>
      </div>
      <AddressBook customer={customer} region={region} />
    </div>
  )
}
