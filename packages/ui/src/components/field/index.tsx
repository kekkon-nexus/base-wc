import { AttachInternals, Component, Element } from "@stencil/core";

import {
	type Control,
	EVENTS,
	getControl,
	setState,
} from "@/components/field/control";
import { focusFirstInvalid } from "@/utils/invalid-focus";

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

	#linked?: Control;

	#observer = new MutationObserver(() => {
		this.#update();
	});

	/** Set by any `invalid` event, which also covers a `checkValidity()` that `:user-invalid` ignores. */
	#reported = false;

	#update = (event?: Event): void => {
		const control = getControl(this.host);
		if (!control) return;
		if (!this.#initial.has(control)) this.#initial.set(control, control.value);

		this.#link(control);

		if (event?.type === "invalid") {
			event.preventDefault();
			this.#reported = true;
			focusFirstInvalid(control, this.host);
		}
		if (control.validity.valid) this.#reported = false;

		if (event?.type === "focusout" && event.target === control) {
			setState(this.internals, "touched", true);
		}
		setState(
			this.internals,
			"dirty",
			control.value !== this.#initial.get(control),
		);
		setState(this.internals, "filled", control.value !== "");

		if (this.#reported || control.matches(":user-invalid")) {
			control.ariaInvalid = "true";
		} else {
			control.removeAttribute("aria-invalid");
		}
	};

	/** @param control the control to describe, set once per control so a framework's replacement is linked too */
	#link(control: Control): void {
		if (control === this.#linked) return;
		this.#linked = control;
		const parts = [
			this.host.querySelector("base-field-description"),
			this.host.querySelector("base-field-errors"),
		].filter((part) => part !== null);
		if (parts.length > 0) control.ariaDescribedByElements = parts;
	}

	connectedCallback(): void {
		this.#abort = new AbortController();
		this.#observer.observe(this.host, { childList: true, subtree: true });
		for (const type of EVENTS) {
			this.host.addEventListener(type, this.#update, {
				capture: type === "invalid",
				signal: this.#abort.signal,
			});
		}
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		this.#observer.disconnect();
	}

	componentDidLoad(): void {
		this.#update();
	}
}
