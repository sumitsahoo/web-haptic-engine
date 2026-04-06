import { defineConfig } from "vite-plus";

import tsdownConfig from "./tsdown.config.ts";

export default defineConfig({
  pack: tsdownConfig,
  lint: { options: { typeAware: true, typeCheck: true } },
});
