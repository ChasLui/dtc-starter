import { listProductsWithSort } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { useServerData } from "@lib/hooks/use-server-data"
import { OptionValueIds } from "@lib/util/product-option-filters"
import ProductPreview from "@modules/products/components/product-preview"
import { Pagination } from "@modules/store/components/pagination"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

const PRODUCT_LIMIT = 12

type PaginatedProductsParams = {
  limit: number
  collection_id?: string[]
  category_id?: string[]
  id?: string[]
  order?: string
}

export default function PaginatedProducts({
  sortBy,
  page,
  collectionId,
  categoryId,
  productsIds,
  countryCode,
  optionValueIds,
}: {
  sortBy?: SortOptions
  page: number
  collectionId?: string
  categoryId?: string
  productsIds?: string[]
  countryCode: string
  optionValueIds?: OptionValueIds
}) {
  const { data } = useServerData(async () => {
    const queryParams: PaginatedProductsParams = {
      limit: 12,
    }

    if (collectionId) {
      queryParams["collection_id"] = [collectionId]
    }

    if (categoryId) {
      queryParams["category_id"] = [categoryId]
    }

    if (productsIds) {
      queryParams["id"] = productsIds
    }

    if (sortBy === "created_at") {
      queryParams["order"] = "created_at"
    }

    const region = await getRegion({ data: countryCode })

    if (!region) {
      return null
    }

    const {
      response: { products, count },
    } = await listProductsWithSort({
      data: {
        page,
        queryParams,
        sortBy,
        countryCode,
        optionValueIds,
      },
    })

    return { products, count, region }
  })

  if (!data) {
    return null
  }

  const totalPages = Math.ceil(data.count / PRODUCT_LIMIT)

  return (
    <>
      <ul
        className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8"
        data-testid="products-list"
      >
        {data.products.map((p) => {
          return (
            <li key={p.id}>
              <ProductPreview product={p} region={data.region} />
            </li>
          )
        })}
      </ul>
      {totalPages > 1 && (
        <Pagination
          data-testid="product-pagination"
          page={page}
          totalPages={totalPages}
        />
      )}
    </>
  )
}
