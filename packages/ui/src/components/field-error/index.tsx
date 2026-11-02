import { AttachInternals, Component, Element, Prop } from "@stencil/core";

import { EVENTS, getControl, setState } from "@/components/field/control";

@Component({
	tag: "base-field-error",
	encapsulation: { type: "none" },
})
export class FieldError {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	/** The validity key this message is for. Without it, the message shows for any invalid value. */
	@Prop() match?: Exclude<keyof ValidityState, "valid">;

	#abort?: AbortController;

	#update = (): void => {
		const control = getControl(this.host.closest("base-field"));
		const shown =
			control?.matches(":user-invalid") === true &&
			(!this.match || control.validity[this.match]);
		this.host.hidden = !shown;
		setState(this.internals, "shown", shown);
	};

	connectedCallback(): void {
		this.#update();
		const field = this.host.closest("base-field");
		if (!field) return;
		this.#abort = new AbortController();
		for (const type of EVENTS) {
			field.addEventListener(type, this.#update, {
				capture: true,
				signal: this.#abort.signal,
			});
		}
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}
}
