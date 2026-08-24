// @ts-check

import reactHooks from "eslint-plugin-react-hooks"
import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  ...tanstackConfig,
  {
    ignores: [
      "dist",
      ".output",
      ".next",
      "node_modules",
      "src/routeTree.gen.ts",
      "eslint.config.js",
    ],
  },
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      // The codebase uses value imports for types and `string[]` syntax
      // throughout; these rules are too strict for the ported storefront.
      "@typescript-eslint/consistent-type-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "import/order": "off",
    },
  },
]
