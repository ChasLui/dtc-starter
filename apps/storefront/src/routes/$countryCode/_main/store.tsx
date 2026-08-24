import { parseOptionValueIds } from "@lib/util/product-option-filters"
import StoreTemplate from "@modules/store/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/_main/store")({
  validateSearch: (search: Record<string, unknown>) => ({
    sortBy: (search.sortBy as SortOptions) ?? ("created_at" as SortOptions),
    page: typeof search.page === "string" ? parseInt(search.page) || 1 : 1,
    optionValueIds: parseOptionValueIds(
      search as Record<string, string | string[] | undefined>,
    ),
  }),
  head: () => ({
    meta: [
      { title: "Store" },
      { name: "description", content: "Explore all of our products." },
    ],
  }),
  component: StorePage,
})

function StorePage() {
  const search = Route.useSearch()
  const { countryCode } = Route.useParams()

  return (
    <StoreTemplate
      sortBy={search.sortBy}
      page={String(search.page)}
      countryCode={countryCode}
      optionValueIds={search.optionValueIds}
    />
  )
}
