import { createFileRoute } from "@tanstack/react-router"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import { useStorefront } from "@lib/context/storefront-context"

export const Route = createFileRoute("/$countryCode/_main/")({
  head: () => ({
    meta: [
      { title: "Medusa TanStack Starter Template" },
      {
        name: "description",
        content:
          "A performant frontend ecommerce starter template with TanStack Start and Medusa.",
      },
    ],
  }),
  component: HomePage,
})

function HomePage() {
  const { collections, region } = useStorefront()

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Hero />
      <div className="py-12">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
    </>
  )
}
