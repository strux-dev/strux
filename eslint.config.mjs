// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        ignores: ['eslint.config.mjs'],
    },
    eslint.configs.recommended,
    ...tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
            },
            sourceType: 'commonjs',
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        rules: {
            "@typescript-eslint/interface-name-prefix": "off",
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "no-trailing-spaces": "error",
            "no-multiple-empty-lines": "error",
            "indent": ["error", 4, {
                "SwitchCase": 1, MemberExpression: 1,
                ignoredNodes: [
                    'FunctionExpression > .params[decorators.length > 0]',
                    'FunctionExpression > .params > :matches(Decorator, :not(:first-child))',
                    'ClassBody.body > PropertyDefinition[decorators.length > 0] > .key',
                ],
            }],
            "linebreak-style": ["error", "unix"],
            "quotes": ["error", "double"],
            "prefer-spread": "off",
            "comma-dangle": [
                "error",
                {
                    "arrays": "only-multiline",
                    "objects": "only-multiline",
                    "imports": "never",
                    "exports": "never",
                    "functions": "never"
                }
            ],
            "@typescript-eslint/no-unused-vars": [
                "warn",
                {
                    "argsIgnorePattern": "^_",
                    "varsIgnorePattern": "^_",
                    "caughtErrorsIgnorePattern": "^_"
                }
            ],
            "semi": ["error", "never"],
            "no-unused-vars": "off",
            "object-curly-spacing": ["error", "always"],
        },
    },
);
