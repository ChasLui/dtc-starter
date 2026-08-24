import { createSerializationAdapter } from "@tanstack/react-router"

/**
 * A no-op serialization adapter registered only to relax the compile-time
 * serializability checks for Medusa SDK response types, which contain
 * `Record<string, unknown>` fields (metadata, etc.) that the default
 * serializable union rejects. At runtime seroval serializes these values
 * natively, so this adapter never matches (`test` always returns false).
 */
export const medusaSerializationAdapter = createSerializationAdapter<
  unknown,
  unknown
>({
  key: "medusa-permissive",
  test: (_value): _value is unknown => false,
  toSerializable: (v) => v as never,
  fromSerializable: (v) => v,
})

declare module "@tanstack/router-core" {
  interface Register {
    config: {
      "~types": {
        serializationAdapters: [typeof medusaSerializationAdapter]
      }
    }
  }
}

declare module "@tanstack/react-router" {
  interface Register {
    config: {
      "~types": {
        serializationAdapters: [typeof medusaSerializationAdapter]
      }
    }
  }
}
