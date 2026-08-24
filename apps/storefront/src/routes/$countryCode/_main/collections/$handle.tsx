import { getCollectionByHandle } from "@lib/data/collections"
import { parseOptionValueIds } from "@lib/util/product-option-filters"
import CollectionTemplate from "@modules/collections/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const PRODUCT_LIMIT = 12

export const Route = createFileRoute("/$countryCode/_main/collections/$handle")({
  validateSearch: (search: Record<string, unknown>) => ({
    sortBy: (search.sortBy as SortOptions) ?? ("created_at" as SortOptions),
    page: typeof search.page === "string" ? parseInt(search.page) || 1 : 1,
    optionValueIds: parseOptionValueIds(
      search as Record<string, string | string[] | undefined>
    ),
  }),
  loader: async ({ params }) => {
    const collection = await getCollectionByHandle({ data: params.handle })

    if (!collection) {
      throw notFound()
    }

    return collection
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData!.title} | Medusa Store` },
      { name: "description", content: `${loaderData!.title} collection` },
    ],
  }),
  component: CollectionPage,
})

function CollectionPage() {
  const collection = Route.useLoaderData()
  const search = Route.useSearch()
  const { countryCode } = Route.useParams()

  return (
    <CollectionTemplate
      collection={collection}
      page={String(search.page)}
      sortBy={search.sortBy}
      countryCode={countryCode}
      optionValueIds={search.optionValueIds}
    />
  )
}
