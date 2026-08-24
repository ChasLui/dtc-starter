import { createStart } from "@tanstack/react-start"

import { medusaSerializationAdapter } from "./lib/serialization"

export const startInstance = createStart(() => ({
  serializationAdapters: [medusaSerializationAdapter],
}))
