import { getOnboardingState } from "@lib/data/onboarding"
import { retrieveOrder } from "@lib/data/orders"
import OrderCompletedTemplate from "@modules/order/templates/order-completed-template"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/_main/order/$id/confirmed")({
  loader: async ({ params }) => {
    const order = await retrieveOrder({ data: params.id }).catch(() => null)

    if (!order) {
      throw notFound()
    }

    const isOnboarding = await getOnboardingState()

    return { order, isOnboarding }
  },
  head: () => ({
    meta: [
      { title: "Order Confirmed" },
      { name: "description", content: "You purchase was successful" },
    ],
  }),
  component: OrderConfirmedPage,
})

function OrderConfirmedPage() {
  const { order, isOnboarding } = Route.useLoaderData()

  return <OrderCompletedTemplate order={order} isOnboarding={isOnboarding} />
}
