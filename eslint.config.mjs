import tseslint from "typescript-eslint";
import globals from "globals";

const baseRules = {
  "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-require-imports": "off",
};

const config = [
  {
    ignores: ["out/**", "node_modules/**", "coverage/**", "*.js", "*.cjs", "*.mjs"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
    rules: baseRules,
  },
  {
    files: ["test/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
    rules: baseRules,
  },
];

export default config;
