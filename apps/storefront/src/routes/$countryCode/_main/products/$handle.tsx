import { useStorefront } from "@lib/context/storefront-context"
import { listProducts } from "@lib/data/products"
import { getOnboardingState } from "@lib/data/onboarding"
import { HttpTypes } from "@medusajs/types"
import ProductTemplate from "@modules/products/templates"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute(
  "/$countryCode/_main/products/$handle"
)({
  validateSearch: (search: Record<string, unknown>) => ({
    v_id: typeof search.v_id === "string" ? search.v_id : undefined,
  }),
  loader: async ({ params }) => {
    const { response } = await listProducts({
      data: {
        countryCode: params.countryCode,
        queryParams: { handle: params.handle },
      },
    })

    const product = response.products[0]

    if (!product) {
      throw notFound()
    }

    const isOnboarding = await getOnboardingState()

    return { product, isOnboarding }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData!.product.title} | Medusa Store` },
      { name: "description", content: `${loaderData!.product.title}` },
      {
        property: "og:title",
        content: `${loaderData!.product.title} | Medusa Store`,
      },
      { property: "og:description", content: `${loaderData!.product.title}` },
      ...(loaderData!.product.thumbnail
        ? [{ property: "og:image", content: loaderData!.product.thumbnail }]
        : []),
    ],
  }),
  component: ProductPage,
})

function getImagesForVariant(
  product: HttpTypes.StoreProduct,
  selectedVariantId?: string
) {
  if (!selectedVariantId || !product.variants) {
    return product.images
  }

  const variant = product.variants!.find((v) => v.id === selectedVariantId)
  if (!variant || !variant.images?.length) {
    return product.images
  }

  const imageIdsMap = new Map(variant.images!.map((i) => [i.id, true]))
  return product.images?.filter((i) => imageIdsMap.has(i.id)) ?? null
}

function ProductPage() {
  const { product, isOnboarding } = Route.useLoaderData()
  const search = Route.useSearch()
  const { countryCode } = Route.useParams()
  const { region } = useStorefront()

  if (!region) {
    throw notFound()
  }

  const images = getImagesForVariant(product, search.v_id)

  return (
    <ProductTemplate
      product={product}
      region={region}
      countryCode={countryCode}
      images={images ?? []}
      isOnboarding={isOnboarding}
    />
  )
}
