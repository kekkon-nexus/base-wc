import { AttachInternals, Component, Element, Prop } from "@stencil/core";

import { setState } from "@/components/field/control";

@Component({
	tag: "base-form-error",
	encapsulation: { type: "none" },
})
export class FormError {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	/** The form-level key this message is for. Without it, this is the catch-all. */
	@Prop() match?: string;

	#abort?: AbortController;

	#update = (): void => {
		const parent = this.host.closest("base-form-errors");
		const key = parent?.errors?.form;
		const shown =
			Boolean(key) &&
			(this.match
				? this.match === key
				: ![...(parent?.querySelectorAll("base-form-error") ?? [])].some(
						({ match }) => match === key,
					));
		this.host.hidden = !shown;
		setState(this.internals, "shown", shown);
	};

	connectedCallback(): void {
		this.#update();
		const parent = this.host.closest("base-form-errors");
		if (!parent) return;
		this.#abort = new AbortController();
		parent.addEventListener("base-form-errors-change", this.#update, {
			signal: this.#abort.signal,
		});
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}
}
