import { retrieveOrder } from "@lib/data/orders"
import OrderDetailsTemplate from "@modules/order/templates/order-details-template"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/$countryCode/_main/account/orders/details/$id",
)({
  loader: async ({ params }) => {
    const order = await retrieveOrder({ data: params.id }).catch(() => null)

    if (!order) {
      throw notFound()
    }

    return order
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `Order #${loaderData!.display_id}` },
      { name: "description", content: "View your order" },
    ],
  }),
  component: OrderDetailPage,
})

function OrderDetailPage() {
  const order = Route.useLoaderData()

  return <OrderDetailsTemplate order={order} />
}
