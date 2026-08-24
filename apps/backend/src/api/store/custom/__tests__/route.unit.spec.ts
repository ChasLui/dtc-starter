import { describe, expect, it, vi } from "vitest"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { GET } from "../route"

describe("GET /store/custom", () => {
  it("responds with 200", async () => {
    const sendStatus = vi.fn()
    const res = { sendStatus } as unknown as MedusaResponse

    await GET({} as unknown as MedusaRequest, res)

    expect(sendStatus).toHaveBeenCalledWith(200)
  })
})
