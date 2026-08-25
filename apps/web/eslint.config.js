import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  {
    ignores: ["dist/**", "eslint.config.js"],
  },
  js.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    linterOptions: {
      // Legacy disable comments remain in the tree; don't fail CI on them.
      reportUnusedDisableDirectives: "off",
    },
    settings: {
      react: {
        version: "19.2",
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-extra-semi": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
      "react/no-unknown-property": "off",
      "react/prop-types": "off",
      "react-hooks/exhaustive-deps": "off",
      // Route modules export many page components from one file.
      "react-refresh/only-export-components": "off",
    },
  },
];
