import { AttachInternals, Component, Element, Prop } from "@stencil/core";

import { EVENTS, getControls, setState } from "@/components/field/control";
import { warn } from "@/utils/dev";
import { failingKeys } from "@/utils/validity";

@Component({
	tag: "base-field-error",
	encapsulation: { type: "none" },
})
export class FieldError {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	/** The key this message is for: a native `validity` key or a custom key. Without it, this is the catch-all. */
	@Prop() match?: string;

	#abort?: AbortController;

	/** Set by any `invalid` event, which also covers a `checkValidity()` that `:user-invalid` ignores. */
	#reported = false;

	#matches(field: Element, keys: Set<string>): boolean {
		if (this.match) return keys.has(this.match);
		return ![...field.querySelectorAll("base-field-error")].some(
			({ match }) => match !== undefined && keys.has(match),
		);
	}

	#update = (event?: Event): void => {
		const field = this.host.closest("base-field");
		const controls = getControls(field);
		if (event?.type === "invalid") this.#reported = true;
		if (controls.every(({ validity }) => validity.valid))
			this.#reported = false;
		if (event?.type === "base-field-reset") this.#reported = false;
		const keys = new Set(
			controls.flatMap((control) => [...failingKeys(control)]),
		);
		const shown =
			field !== null &&
			controls.length > 0 &&
			(this.#reported ||
				controls.some((control) => control.matches(":user-invalid"))) &&
			this.#matches(field, keys);
		this.host.hidden = !shown;
		setState(this.internals, "shown", shown);
	};

	connectedCallback(): void {
		if (__DEV__ && (this.match === "customError" || this.match === "valid")) {
			warn(
				`match="${this.match}" never shows: use a custom key or a catch-all.`,
			);
		}
		this.#update();
		const field = this.host.closest("base-field");
		if (!field) return;
		this.#abort = new AbortController();
		for (const type of EVENTS) {
			field.addEventListener(type, this.#update, {
				capture: type === "invalid",
				signal: this.#abort.signal,
			});
		}
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}
}
