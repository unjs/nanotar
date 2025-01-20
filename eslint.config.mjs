import unjs from "eslint-config-unjs";

// https://github.com/unjs/eslint-config
export default unjs({
  ignores: [],
  rules: {
  "@typescript-eslint/no-non-null-assertion": 0,
  "unicorn/prefer-top-level-await": 0
},
});