import {
	type proxyComponent,
	transformTag,
} from "@stencil/core/runtime/client/standalone";

type ComponentConstructor = ReturnType<typeof proxyComponent>;

// Stencil compiles components into `HTMLElement` subclasses with a static `is` holding the
// decorator's tag; the source classes declare neither.
export function define(component: unknown): void {
	const constructor = component as CustomElementConstructor &
		ComponentConstructor;
	// oxlint-disable-next-line typescript/no-non-null-assertion -- `proxyCustomElement` always sets `is`
	const tag = transformTag(constructor.is!);
	if (!customElements.get(tag)) customElements.define(tag, constructor);
}
