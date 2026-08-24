import { defineConfig } from "vitest/config"
import { loadEnv } from "@medusajs/utils"

loadEnv("test", process.cwd())

const testType = process.env.TEST_TYPE ?? "unit"

const include =
  testType === "integration:http"
    ? ["integration-tests/http/*.spec.ts"]
    : testType === "integration:modules"
      ? ["src/modules/*/__tests__/**/*.ts"]
      : ["src/**/__tests__/**/*.unit.spec.ts"]

export default defineConfig({
  test: {
    environment: "node",
    include,
    exclude: ["node_modules/**", "dist/**", ".medusa/**"],
    setupFiles: ["./integration-tests/setup.js"],
    fileParallelism: false,
  },
})
