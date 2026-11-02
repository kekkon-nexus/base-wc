import "vite-plus/test/browser";

declare global {
	/** Replaced at build time: `true` only in the development build. */
	const __DEV__: boolean;
}

declare module "vite-plus/test/browser" {
	interface BrowserCommands {
		computedDescription: (selector: string) => Promise<string>;
		computedProperty: (selector: string, name: string) => Promise<string>;
	}
}
