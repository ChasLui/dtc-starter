import { getCategoryByHandle } from "@lib/data/categories"
import { parseOptionValueIds } from "@lib/util/product-option-filters"
import CategoryTemplate from "@modules/categories/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import { createFileRoute, notFound } from "@tanstack/react-router"

export const Route = createFileRoute("/$countryCode/_main/categories/$")({
  validateSearch: (search: Record<string, unknown>) => ({
    sortBy: (search.sortBy as SortOptions) ?? ("created_at" as SortOptions),
    page: typeof search.page === "string" ? parseInt(search.page) || 1 : 1,
    optionValueIds: parseOptionValueIds(
      search as Record<string, string | string[] | undefined>,
    ),
  }),
  loader: async ({ params }) => {
    const categoryHandle = params._splat?.split("/").filter(Boolean) ?? []

    const productCategory = await getCategoryByHandle({ data: categoryHandle })

    if (!productCategory) {
      throw notFound()
    }

    return { productCategory, categoryHandle }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData!.productCategory.name} | Medusa Store` },
      {
        name: "description",
        content:
          loaderData!.productCategory.description ??
          `${loaderData!.productCategory.name} category.`,
      },
    ],
  }),
  component: CategoryPage,
})

function CategoryPage() {
  const { productCategory } = Route.useLoaderData()
  const search = Route.useSearch()
  const { countryCode } = Route.useParams()

  return (
    <CategoryTemplate
      category={productCategory}
      sortBy={search.sortBy}
      page={String(search.page)}
      countryCode={countryCode}
      optionValueIds={search.optionValueIds}
    />
  )
}
