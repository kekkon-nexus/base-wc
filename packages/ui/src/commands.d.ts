import "vite-plus/test/browser";

declare module "vite-plus/test/browser" {
	interface BrowserCommands {
		computedDescription: (selector: string) => Promise<string>;
		computedInvalid: (selector: string) => Promise<string>;
	}
}
