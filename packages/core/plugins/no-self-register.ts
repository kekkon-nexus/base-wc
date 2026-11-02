import type { Plugin } from "vite-plus";

/**
 * Workaround: `@stencil/unplugin` hardcodes `componentExport: "customelement"`, so every
 * component registers itself on import. Importing `proxyCustomElement` under the same
 * local name keeps the metadata proxy and drops `customElements.define`; registration
 * lives in each component's `define.ts`.
 */
export const noSelfRegister: Plugin = {
	name: "no-self-register",
	transform: {
		filter: { code: "defineCustomElement" },
		handler(code) {
			const specifier = this.parse(code)
				.body.filter((node) => node.type === "ImportDeclaration")
				.filter((node) =>
					node.source.value.startsWith("@stencil/core/runtime/"),
				)
				.flatMap((node) => node.specifiers)
				.filter((node) => node.type === "ImportSpecifier")
				.find(
					({ imported }) =>
						imported.type === "Identifier" &&
						imported.name === "defineCustomElement",
				);

			return (
				specifier && {
					code: `${code.slice(0, specifier.imported.start)}proxyCustomElement as ${specifier.local.name}${code.slice(specifier.end)}`,
					// oxlint-disable-next-line unicorn/no-null -- Rolldown reads `null` as "keep the existing sourcemap"
					map: null,
				}
			);
		},
	},
};
