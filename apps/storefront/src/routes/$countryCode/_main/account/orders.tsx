import { listOrders } from "@lib/data/orders"
import Divider from "@modules/common/components/divider"
import TransferRequestForm from "@modules/account/components/transfer-request-form"
import OrderOverview from "@modules/account/components/order-overview"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/_main/account/orders")({
  loader: async () => {
    const orders = await listOrders({ data: {} })

    if (!orders) {
      throw notFound()
    }

    return { orders }
  },
  head: () => ({
    meta: [
      { title: "Orders" },
      { name: "description", content: "Overview of your previous orders." },
    ],
  }),
  component: OrdersPage,
})

function OrdersPage() {
  const { orders } = Route.useLoaderData()

  return (
    <div className="w-full" data-testid="orders-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Orders</h1>
        <p className="text-base-regular">
          View your previous orders and their status. You can also create
          returns or exchanges for your orders if needed.
        </p>
      </div>
      <div>
        <OrderOverview orders={orders} />
        <Divider className="mb-8 mt-8" />
        <TransferRequestForm />
      </div>
    </div>
  )
}
