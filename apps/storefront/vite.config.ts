import checkEnvVariables from "./check-env-variables.cjs"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nitro } from "nitro/vite"

checkEnvVariables()

const srcDir = new URL("./src", import.meta.url).pathname

const config = defineConfig({
  server: {
    port: 8000,
  },
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  resolve: {
    alias: {
      "~": srcDir,
      "@lib": `${srcDir}/lib`,
      "@modules": `${srcDir}/modules`,
      "@pages": `${srcDir}/pages`,
    },
  },
  plugins: [tanstackStart({ srcDirectory: "src" }), viteReact(), nitro()],
})

export default config
