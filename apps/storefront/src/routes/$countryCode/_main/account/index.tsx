import { listOrders } from "@lib/data/orders"
import Overview from "@modules/account/components/overview"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/_main/account/")({
  loader: async () => {
    const customer = await import("@lib/data/customer").then((m) =>
      m.retrieveCustomer()
    )
    const orders = (await listOrders({ data: {} }).catch(() => null)) || null

    if (!customer) {
      throw notFound()
    }

    return { customer, orders }
  },
  head: () => ({
    meta: [
      { title: "Account" },
      { name: "description", content: "Overview of your account activity." },
    ],
  }),
  component: OverviewPage,
})

function OverviewPage() {
  const { customer, orders } = Route.useLoaderData()

  return <Overview customer={customer} orders={orders} />
}
