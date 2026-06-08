import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default tseslint.config(
  {
    ignores: [
      "dist",
      "coverage",
      "node_modules",
    ],
  },
  {
    files: ["playwright.config.ts", "vite.config.ts", "vitest.config.ts", "tailwind.config.js", "e2e/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.app.json', './tsconfig.node.json']
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "sonarjs": sonarjs,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "off",
      "sonarjs/no-nested-template-literals": "warn",
      "sonarjs/cognitive-complexity": ["warn", 15],
      "sonarjs/no-duplicate-string": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }],

      /**
       * ──────────────────────────────────────────────────────────────────────
       * System-wide Architecture Guards (Single Source of Truth)
       * ──────────────────────────────────────────────────────────────────────
       *
       * These rules enforce the project's stack decisions:
       * - React Query for server-state
       * - Tailwind + shadcn/ui for UI styling
       * - lucide-react for icons
       * - No ad-hoc inline styles / random CSS imports
       */

      // UI styling guard is disabled for now because the codebase
      // legitimately uses theme variables via inline style objects.
      "no-restricted-syntax": "off",

      // Icons: lucide-react only.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@fortawesome/*",
                "react-icons",
                "react-icons/*",
                "@heroicons/*",
                "@mui/icons-material",
                "@mui/icons-material/*",
                "phosphor-react",
                "tabler-icons-react",
              ],
              message: "Icons must come from `lucide-react` only.",
            },
            {
              group: [
                "axios",
                "swr",
                "use-swr",
                "@reduxjs/toolkit",
              ],
              message:
                "Do not introduce alternative data/state libraries. Use React Query for server state and local state hooks for UI.",
            },
          ],
        },
      ],
    },
  },
  {
    // UI-heavy TSX repeats Tailwind classes and i18n keys; SonarCloud still tracks duplication.
    files: ["**/*.tsx", "e2e/**/*.ts"],
    rules: {
      "sonarjs/no-duplicate-string": ["warn", { threshold: 20 }],
    },
  },
  {
    files: ["services/**/*.ts"],
    ignores: ["**/*.test.ts"],
    rules: {
      "sonarjs/no-duplicate-string": ["warn", { threshold: 5 }],
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.setup.ts", "**/__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "sonarjs/no-duplicate-string": "off",
    },
  },
);
