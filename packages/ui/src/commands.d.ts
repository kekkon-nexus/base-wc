import "vite-plus/test/browser";

declare module "vite-plus/test/browser" {
	interface BrowserCommands {
		computedDescription: (selector: string) => Promise<string>;
		computedProperty: (selector: string, name: string) => Promise<string>;
	}
}
