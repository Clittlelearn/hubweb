import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["dist", "docs", "node_modules", "src/**/*.{ts,tsx}"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
];
