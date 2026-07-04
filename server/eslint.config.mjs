import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
   { ignores: ["dist/**", "node_modules/**"] },
   js.configs.recommended,
   ...tseslint.configs.recommended,
   {
      rules: {
         // This codebase uses `any` deliberately in a few DI/repo-generic spots —
         // keep the check as a warning (visible, not a CI-blocking error).
         "@typescript-eslint/no-explicit-any": "warn",
         "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
         // error.typings.ts intentionally maps several distinct semantic error
         // codes onto the same HTTP status (e.g. both an expired token and a
         // generic auth failure are 401) — that's a legitimate many-to-one
         // relationship, not a copy-paste mistake.
         "@typescript-eslint/no-duplicate-enum-values": "off",
      },
   },
   eslintConfigPrettier,
);
