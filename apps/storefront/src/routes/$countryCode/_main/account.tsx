import { retrieveCustomer } from "@lib/data/customer"
import AccountLayout from "@modules/account/templates/account-layout"
import LoginTemplate from "@modules/account/templates/login-template"
import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/_main/account")({
  loader: async () => {
    const customer = await retrieveCustomer().catch(() => null)
    return { customer }
  },
  component: AccountPage,
})

function AccountPage() {
  const { customer } = Route.useLoaderData()

  if (!customer) {
    return <LoginTemplate />
  }

  return (
    <AccountLayout customer={customer}>
      <Outlet />
    </AccountLayout>
  )
}
