import { listProducts } from "@lib/data/products"
import { useServerData } from "@lib/hooks/use-server-data"
import { HttpTypes } from "@medusajs/types"
import ProductActions from "@modules/products/components/product-actions"

/**
 * Fetches real time pricing for a product and renders the product actions component.
 */
export default function ProductActionsWrapper({
  id,
  region,
}: {
  id: string
  region: HttpTypes.StoreRegion
}) {
  const { data: product } = useServerData(async () => {
    const response = await listProducts({
      data: {
        queryParams: { id: [id] },
        regionId: region.id,
      },
    })
    return response.response.products[0]
  })

  if (!product) {
    return null
  }

  return <ProductActions product={product} region={region} />
}
