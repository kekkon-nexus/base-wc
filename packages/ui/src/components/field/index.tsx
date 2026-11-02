import { AttachInternals, Component, Element } from "@stencil/core";

import {
	type Control,
	EVENTS,
	getControl,
	setState,
} from "@/components/field/control";

@Component({
	tag: "base-field",
	encapsulation: { type: "none" },
})
export class Field {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	#abort?: AbortController;

	/** `dirty` compares against the value the control had when the field first saw it. */
	#initial = new WeakMap<Control, string>();

	#update = (event?: Event): void => {
		const control = getControl(this.host);
		if (!control) return;
		if (!this.#initial.has(control)) this.#initial.set(control, control.value);

		if (event?.type === "focusout" && event.target === control) {
			setState(this.internals, "touched", true);
		}
		setState(
			this.internals,
			"dirty",
			control.value !== this.#initial.get(control),
		);
		setState(this.internals, "filled", control.value !== "");

		if (control.matches(":user-invalid")) {
			control.setAttribute("aria-invalid", "true");
		} else {
			control.removeAttribute("aria-invalid");
		}
	};

	connectedCallback(): void {
		this.#abort = new AbortController();
		for (const type of EVENTS) {
			this.host.addEventListener(type, this.#update, {
				capture: true,
				signal: this.#abort.signal,
			});
		}
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}

	componentDidLoad(): void {
		this.#update();
	}
}
