import { acceptTransferRequest } from "@lib/data/orders"
import { Heading, Text } from "@modules/common/components/ui"
import TransferImage from "@modules/order/components/transfer-image"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/$countryCode/_main/order/$id/transfer/$token/accept",
)({
  loader: async ({ params }) => {
    const { success, error } = await acceptTransferRequest({
      data: { id: params.id, token: params.token },
    })

    return { success, error }
  },
  component: TransferAcceptPage,
})

function TransferAcceptPage() {
  const { id } = Route.useParams()
  const { success, error } = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-y-4 items-start w-2/5 mx-auto mt-10 mb-20">
      <TransferImage />
      <div className="flex flex-col gap-y-6">
        {success && (
          <>
            <Heading level="h1" className="text-xl text-zinc-900">
              Order transfered!
            </Heading>
            <Text className="text-zinc-600">
              Order {id} has been successfully transfered to the new owner.
            </Text>
          </>
        )}
        {!success && (
          <>
            <Text className="text-zinc-600">
              There was an error accepting the transfer. Please try again.
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
