import { glob } from "node:fs/promises";

import oxfmt from "@kekkon-nexus/config/oxfmt";
import oxlint from "@kekkon-nexus/config/oxlint";
import vp from "@kekkon-nexus/config/oxlint/vite-plus";
import { defineConfig } from "vite-plus";

const config: ReturnType<typeof defineConfig> = defineConfig({
	fmt: {
		...oxfmt,
		ignorePatterns: ["packages/ui/src/components.d.ts"],
	},
	lint: {
		extends: [oxlint, vp],
		ignorePatterns: ["packages/ui/src/components.d.ts"],
		options: {
			typeAware: true,
			typeCheck: true,
		},
		jsPlugins: [
			{
				name: "no-relative-import-paths",
				specifier: "eslint-plugin-no-relative-import-paths",
			},
		],

		env: {
			node: true,
		},
		globals: {
			__DEV__: "readonly",
		},
		overrides: await Array.fromAsync(glob("packages/*"), (dir) => ({
			files: [`${dir}/**`],
			env: { browser: true },
			rules: {
				"no-relative-import-paths/no-relative-import-paths": [
					"warn",
					{
						allowSameFolder: false,
						rootDir: `./${dir}/src`,
						prefix: "@",
					},
				],
			},
		})),
	},
	staged: {
		"*": "vp check --fix --no-error-on-unmatched-pattern",
	},

	resolve: {
		tsconfigPaths: true,
	},

	run: {
		cache: true,
	},

	test: {
		projects: ["packages/*"],
	},
});

export default config;
