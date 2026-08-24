import { getCountryCode } from "@lib/data/regions"
import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const countryCode = await getCountryCode()

    throw redirect({
      to: "/$countryCode",
      params: { countryCode },
      replace: true,
    })
  },
})
