import { createServerFn } from "@tanstack/react-start"
import { redirect } from "@tanstack/react-router"
import { getCookie, setCookie } from "@tanstack/react-start/server"

export const getOnboardingState = createServerFn({ method: "GET" }).handler(
  async () => {
    try {
      return getCookie("_medusa_onboarding") === "true"
    } catch {
      return false
    }
  },
)

export const resetOnboardingState = createServerFn({ method: "POST" })
  .validator((orderId: string) => orderId)
  .handler(async ({ data: orderId }) => {
    setCookie("_medusa_onboarding", "false", { maxAge: -1 })
    throw redirect({ href: `http://localhost:7001/a/orders/${orderId}` })
  })
