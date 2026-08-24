import { getCookie, setCookie } from "@tanstack/react-start/server"

export const getAuthHeaders = async (): Promise<
  { authorization: string } | Record<string, never>
> => {
  try {
    const token = getCookie("_medusa_jwt")

    if (!token) {
      return {}
    }

    return { authorization: `Bearer ${token}` }
  } catch {
    return {}
  }
}

export const getCacheTag = async (tag: string): Promise<string> => {
  try {
    const cacheId = getCookie("_medusa_cache_id")

    if (!cacheId) {
      return ""
    }

    return `${tag}-${cacheId}`
  } catch {
    return ""
  }
}

export const getCacheOptions = async (
  tag: string
): Promise<{ tags: string[] } | Record<string, never>> => {
  if (typeof window !== "undefined") {
    return {}
  }

  const cacheTag = await getCacheTag(tag)

  if (!cacheTag) {
    return {}
  }

  return { tags: [`${cacheTag}`] }
}

export const setAuthToken = async (token: string) => {
  setCookie("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeAuthToken = async () => {
  setCookie("_medusa_jwt", "", {
    maxAge: -1,
  })
}

export type PendingCustomer = {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
}

// During the email verification flow the customer record isn't created until
// the customer verifies their email and logs in. We temporarily persist the
// extra signup fields in a cookie so they survive the customer leaving to open
// their inbox, and read them back when creating the customer at login.
export const setPendingCustomer = async (customer: PendingCustomer) => {
  setCookie("_medusa_pending_customer", JSON.stringify(customer), {
    maxAge: 60 * 60 * 24,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const getPendingCustomer = async (): Promise<PendingCustomer | null> => {
  try {
    const value = getCookie("_medusa_pending_customer")

    if (!value) {
      return null
    }

    return JSON.parse(value) as PendingCustomer
  } catch {
    return null
  }
}

export const removePendingCustomer = async () => {
  setCookie("_medusa_pending_customer", "", {
    maxAge: -1,
  })
}

export const getCartId = async () => {
  try {
    return getCookie("_medusa_cart_id")
  } catch {
    return undefined
  }
}

export const setCartId = async (cartId: string) => {
  setCookie("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeCartId = async () => {
  setCookie("_medusa_cart_id", "", {
    maxAge: -1,
  })
}

export const getOnboardingState = async (): Promise<boolean> => {
  try {
    return getCookie("_medusa_onboarding") === "true"
  } catch {
    return false
  }
}
