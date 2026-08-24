import { listProducts } from "@lib/data/products"
import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"

import InteractiveLink from "@modules/common/components/interactive-link"
import ProductPreview from "@modules/products/components/product-preview"
import { useServerData } from "@lib/hooks/use-server-data"

export default function ProductRail({
  collection,
  region,
}: {
  collection: HttpTypes.StoreCollection
  region: HttpTypes.StoreRegion
}) {
  const { data } = useServerData(() =>
    listProducts({
      data: {
        regionId: region.id,
        queryParams: {
          collection_id: collection.id,
          fields: "*variants.calculated_price",
        },
      },
    }),
  )

  const pricedProducts = data?.response.products

  if (!pricedProducts) {
    return null
  }

  return (
    <div className="content-container py-12 small:py-24">
      <div className="flex justify-between mb-8">
        <Text className="txt-xlarge">{collection.title}</Text>
        <InteractiveLink href={`/collections/${collection.handle}`}>
          View all
        </InteractiveLink>
      </div>
      <ul className="grid grid-cols-2 small:grid-cols-3 gap-x-6 gap-y-24 small:gap-y-36">
        {pricedProducts &&
          pricedProducts.map((product) => (
            <li key={product.id}>
              <ProductPreview product={product} region={region} isFeatured />
            </li>
          ))}
      </ul>
    </div>
  )
}
