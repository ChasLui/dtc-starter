import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/$countryCode/_main/order/$id/transfer/$token",
)({
  component: TransferLayout,
})

function TransferLayout() {
  return <Outlet />
}
