import { declineTransferRequest } from "@lib/data/orders"
import { Heading, Text } from "@modules/common/components/ui"
import TransferImage from "@modules/order/components/transfer-image"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/$countryCode/_main/order/$id/transfer/$token/decline",
)({
  loader: async ({ params }) => {
    const { success, error } = await declineTransferRequest({
      data: { id: params.id, token: params.token },
    })

    return { success, error }
  },
  component: TransferDeclinePage,
})

function TransferDeclinePage() {
  const { id } = Route.useParams()
  const { success, error } = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-y-4 items-start w-2/5 mx-auto mt-10 mb-20">
      <TransferImage />
      <div className="flex flex-col gap-y-6">
        {success && (
          <>
            <Heading level="h1" className="text-xl text-zinc-900">
              Order transfer declined!
            </Heading>
            <Text className="text-zinc-600">
              Transfer of order {id} has been successfully declined.
            </Text>
          </>
        )}
        {!success && (
          <>
            <Text className="text-zinc-600">
              There was an error declining the transfer. Please try again.
            </Text>
            {error && (
              <Text className="text-red-500">Error message: {error}</Text>
            )}
          </>
        )}
      </div>
    </div>
  )
}
