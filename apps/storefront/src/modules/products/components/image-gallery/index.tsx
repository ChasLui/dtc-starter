import { HttpTypes } from "@medusajs/types"
import { Container } from "@modules/common/components/ui"

type ImageGalleryProps = {
  images: HttpTypes.StoreProductImage[]
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  return (
    <div className="flex items-start relative">
      <div className="flex flex-col flex-1 small:mx-16 gap-y-4">
        {images.map((image, index) => {
          return (
            <Container
              key={image.id}
              className="relative aspect-[29/34] w-full overflow-hidden bg-ui-bg-subtle"
              id={image.id}
            >
              {!!image.url && (
                <img
                  src={image.url}
                  loading={index <= 2 ? "eager" : "lazy"}
                  className="absolute inset-0 w-full h-full rounded-rounded object-cover"
                  alt={`Product image ${index + 1}`}
                  sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
                />
              )}
            </Container>
          )
        })}
      </div>
    </div>
  )
}

export default ImageGallery
