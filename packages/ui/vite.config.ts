import { unpluginStencil } from "@stencil/unplugin";
import { webdriverio } from "@vitest/browser-webdriverio";
import { defineConfig } from "vite-plus";

// oxlint-disable no-relative-import-paths/no-relative-import-paths -- Vite doesn't resolve tsconfig paths in its own config
import {
	computedDescription,
	computedInvalid,
} from "./commands/computed-description.ts";
import { noSelfRegister } from "./plugins/no-self-register.ts";
// oxlint-enable no-relative-import-paths/no-relative-import-paths

const { CHROME_BIN, FIREFOX_BIN, SAFARI_BIN } = process.env;

const config: ReturnType<typeof defineConfig> = defineConfig({
	resolve: {
		tsconfigPaths: true,
	},

	plugins: [unpluginStencil.vite(), noSelfRegister],

	// Stencil's compiled output imports these, so Vite only discovers them mid-run
	// and reloads the page under the running test.
	optimizeDeps: {
		include: ["@stencil/core/app-data", "@stencil/core/jsx-runtime"],
	},

	test: {
		include: ["src/**/*.test.{ts,tsx}"],
		browser: {
			enabled: true,
			headless: true,
			provider: webdriverio(),
			commands: { computedDescription, computedInvalid },
			// WebdriverIO downloads a browser it isn't given a path to, so a browser
			// only runs when its path is set. It fetches the matching driver itself.
			instances: [
				...(CHROME_BIN
					? [
							{
								browser: "chrome" as const,
								provider: webdriverio({
									capabilities: {
										"goog:chromeOptions": { binary: CHROME_BIN },
										"wdio:enforceWebDriverClassic": true,
									},
								}),
							},
						]
					: []),
				...(FIREFOX_BIN
					? [
							{
								browser: "firefox" as const,
								provider: webdriverio({
									capabilities: {
										"moz:firefoxOptions": {
											binary: FIREFOX_BIN,
											prefs: { "dom.shadowdom.referenceTarget.enabled": true },
										},
										"wdio:enforceWebDriverClassic": true,
									},
								}),
							},
						]
					: []),
				// Safari has no binary to point at, so `SAFARI_BIN` only needs to be truthy.
				...(SAFARI_BIN
					? [{ browser: "safari" as const, headless: false }]
					: []),
			],
		},
	},

	pack: {
		plugins: [
			unpluginStencil.rolldown({
				docs: true,
				types: true,
			}),
			noSelfRegister,
		],

		entry: ["src/**/*.{ts,tsx}", "!src/**/*.test.{ts,tsx}", "!src/**/*.d.ts"],
		root: "src",
		unbundle: true,

		copy: ["src/components.d.ts"],

		fixedExtension: false,
		sourcemap: true,
	},
});

export default config;
