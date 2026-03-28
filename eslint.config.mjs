import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.vite/**", "**/coverage/**"],
    linterOptions: {
      reportUnusedDisableDirectives: "error"
    }
  },
  {
    ...js.configs.recommended,
    files: ["eslint.config.mjs"]
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["client/**/*.{ts,tsx,mts,cts}", "server/**/*.ts", "shared/**/*.ts"]
  })),
  {
    files: ["client/**/*.{ts,tsx,mts,cts}", "server/**/*.ts", "shared/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: [
          "./client/tsconfig.json",
          "./client/tsconfig.test.json",
          "./server/tsconfig.json",
          "./server/tsconfig.test.json"
        ],
        tsconfigRootDir
      }
    },
    plugins: {
      "unused-imports": unusedImports
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-namespace": [
        "error",
        {
          allowDeclarations: true
        }
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports"
        }
      ],
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          ignoreRestSiblings: true
        }
      ]
    }
  },
  {
    files: ["client/**/*.{ts,tsx}", "client/vite.config.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "react-refresh/only-export-components": [
        "off",
        {
          allowConstantExport: true
        }
      ]
    }
  },
  {
    files: ["server/**/*.ts", "shared/**/*.ts", "eslint.config.mjs"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022
      }
    }
  },
  eslintConfigPrettier
);
