import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { createServerFn } from "@tanstack/react-start"

export const listCategories = createServerFn({ method: "GET" })
  .validator((query?: Record<string, unknown>) => query ?? {})
  .handler(async ({ data: query }) => {
    const limit = query?.limit || 100

    return sdk.client
      .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
        "/store/product-categories",
        {
          query: {
            fields:
              "*category_children, *products, *parent_category, *parent_category.parent_category",
            limit,
            ...query,
          },
        }
      )
      .then(({ product_categories }) => product_categories)
  })

export const getCategoryByHandle = createServerFn({ method: "GET" })
  .validator((categoryHandle: string[]) => categoryHandle)
  .handler(async ({ data: categoryHandle }) => {
    const handle = `${categoryHandle.join("/")}`

    return sdk.client
      .fetch<HttpTypes.StoreProductCategoryListResponse>(
        `/store/product-categories`,
        {
          query: {
            fields: "*category_children, *products",
            handle,
          },
        }
      )
      .then(({ product_categories }) => product_categories[0])
  })
