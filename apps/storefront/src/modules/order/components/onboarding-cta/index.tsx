"use client"

import { resetOnboardingState } from "@lib/data/onboarding"
import { Button, Container, Text } from "@modules/common/components/ui"
import { isRedirect, useRouter } from "@tanstack/react-router"

const OnboardingCta = ({ orderId }: { orderId: string }) => {
  const router = useRouter()

  const handleCompleteSetup = async () => {
    try {
      await resetOnboardingState({ data: orderId })
    } catch (error) {
      if (isRedirect(error)) {
        router.navigate({
          href: (error as { options: { href: string } }).options.href,
        })
        return
      }
      throw error
    }
  }

  return (
    <Container className="max-w-4xl h-full bg-ui-bg-subtle w-full">
      <div className="flex flex-col gap-y-4 center p-4 md:items-center">
        <Text className="text-ui-fg-base text-xl">
          Your test order was successfully created!
        </Text>
        <Text className="text-ui-fg-subtle text-small-regular">
          You can now complete setting up your store in the admin.
        </Text>
        <Button className="w-fit" size="large" onClick={handleCompleteSetup}>
          Complete setup in admin
        </Button>
      </div>
    </Container>
  )
}

export default OnboardingCta
