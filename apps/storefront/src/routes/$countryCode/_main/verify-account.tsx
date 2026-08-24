import VerifyAccount from "@modules/account/components/verify-account"
import { createFileRoute } from "@tanstack/react-router"
import { Suspense } from "react"

export const Route = createFileRoute("/$countryCode/_main/verify-account")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Verify your email" },
      {
        name: "description",
        content: "Verify your email address to complete your registration.",
      },
    ],
  }),
  component: VerifyAccountPage,
})

function VerifyAccountPage() {
  const search = Route.useSearch()

  return (
    <div className="w-full flex justify-center px-8 py-12">
      <Suspense
        fallback={
          <p className="text-base-regular text-ui-fg-base">
            Verifying your email...
          </p>
        }
      >
        <VerifyAccount token={search.token} />
      </Suspense>
    </div>
  )
}
