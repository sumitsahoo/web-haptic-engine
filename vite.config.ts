import { defineConfig } from 'vite-plus';

import tsdownConfig from './tsdown.config';

export default defineConfig({
  pack: tsdownConfig,
  lint: {"options":{"typeAware":true,"typeCheck":true}},
});
