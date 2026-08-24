export const getEnv = (name: string): string | undefined => {
  return (import.meta.env as Record<string, string | undefined>)[name]
}

export const getBaseURL = () => {
  return getEnv("NEXT_PUBLIC_BASE_URL") || "https://localhost:8000"
}

export const getBackendUrl = () => {
  return getEnv("NEXT_PUBLIC_MEDUSA_BACKEND_URL") || "http://localhost:9000"
}

export const getPublishableKey = () => {
  return getEnv("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY")
}
