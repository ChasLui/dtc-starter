import { retrieveCustomer } from "@lib/data/customer"
import { listRegions } from "@lib/data/regions"
import ProfileBillingAddress from "@modules/account/components/profile-billing-address"
import ProfileEmail from "@modules/account/components/profile-email"
import ProfileName from "@modules/account/components/profile-name"
import ProfilePhone from "@modules/account/components/profile-phone"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/_main/account/profile")({
  loader: async () => {
    const customer = await retrieveCustomer()
    const regions = await listRegions()

    if (!customer || !regions) {
      throw notFound()
    }

    return { customer, regions }
  },
  head: () => ({
    meta: [
      { title: "Profile" },
      {
        name: "description",
        content: "View and edit your Medusa Store profile.",
      },
    ],
  }),
  component: ProfilePage,
})

function ProfilePage() {
  const { customer, regions } = Route.useLoaderData()

  return (
    <div className="w-full" data-testid="profile-page-wrapper">
      <div className="mb-8 flex flex-col gap-y-4">
        <h1 className="text-2xl-semi">Profile</h1>
        <p className="text-base-regular">
          View and update your profile information, including your name, email,
          and phone number. You can also update your billing address, or change
          your password.
        </p>
      </div>
      <div className="flex flex-col gap-y-8 w-full">
        <ProfileName customer={customer} />
        <Divider />
        <ProfileEmail customer={customer} />
        <Divider />
        <ProfilePhone customer={customer} />
        <Divider />
        {/* <ProfilePassword customer={customer} />
        <Divider /> */}
        <ProfileBillingAddress customer={customer} regions={regions} />
      </div>
    </div>
  )
}

const Divider = () => {
  return <div className="w-full h-px bg-gray-200" />
}
