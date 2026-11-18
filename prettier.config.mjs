/** @type {import("prettier").Config} */
const prettierConfig = {
  printWidth: 120,
  overrides: [
    {
      // shadcn/ui primitives keep the style the shadcn CLI generates them in.
      files: "src/components/ui/**",
      options: { printWidth: 80, semi: false, trailingComma: "es5" },
    },
    {
      // Keep one line per paragraph, and tables wider than printWidth compact instead of padded.
      files: "*.md",
      options: { proseWrap: "never" },
    },
  ],
};

export default prettierConfig;
