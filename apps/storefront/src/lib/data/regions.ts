import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getEnv } from "@lib/util/env"
import { createServerFn } from "@tanstack/react-start"
import { getRequest, getRequestHeader } from "@tanstack/react-start/server"

const DEFAULT_REGION = getEnv("NEXT_PUBLIC_DEFAULT_REGION") || "dk"

export const listRegions = createServerFn({ method: "GET" }).handler(
  async () => {
    return sdk.client
      .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
        method: "GET",
      })
      .then(({ regions }) => regions)
  }
)

export const retrieveRegion = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    return sdk.client
      .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
        method: "GET",
      })
      .then(({ region }) => region)
  })

const regionMap = new Map<string, HttpTypes.StoreRegion>()

export const getRegion = createServerFn({ method: "GET" })
  .validator((countryCode: string) => countryCode)
  .handler(async ({ data: countryCode }) => {
    if (regionMap.has(countryCode)) {
      return regionMap.get(countryCode) ?? null
    }

    const regions = await listRegions()

    if (!regions) {
      return null
    }

    regions.forEach((region) => {
      region.countries?.forEach((c) => {
        regionMap.set(c?.iso_2 ?? "", region)
      })
    })

    const region = countryCode
      ? regionMap.get(countryCode)
      : regionMap.get("us")

    return region ?? null
  })

/**
 * Builds a map of country codes to regions, cached in memory for an hour.
 * Mirrors the country detection of the original Next.js middleware.
 */
const buildRegionMap = async () => {
  const regions = await listRegions()
  const map = new Map<string, HttpTypes.StoreRegion>()

  regions?.forEach((region) => {
    region.countries?.forEach((c) => {
      map.set(c.iso_2 ?? "", region)
    })
  })

  return map
}

/**
 * Determines the country code for the current request. Prefers the URL,
 * then geo headers (Cloudflare / Vercel), then the default region.
 */
export const getCountryCode = createServerFn({ method: "GET" }).handler(
  async () => {
    const regionMap = await buildRegionMap()
    let countryCode: string | undefined

    const request = getRequest()
    const url = request?.url ?? ""
    const urlCountryCode = url.split("/")[3]?.toLowerCase()

    const cloudflareCountryCode = (
      getRequestHeader("cf-ipcountry") ?? ""
    ).toLowerCase()
    const vercelCountryCode = (
      getRequestHeader("x-vercel-ip-country") ?? ""
    ).toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (cloudflareCountryCode && regionMap.has(cloudflareCountryCode)) {
      countryCode = cloudflareCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode || DEFAULT_REGION
  }
)
