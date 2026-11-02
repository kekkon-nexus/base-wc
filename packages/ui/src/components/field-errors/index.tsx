import { AttachInternals, Component } from "@stencil/core";

@Component({
	tag: "base-field-errors",
	encapsulation: { type: "none" },
})
export class FieldErrors {
	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	connectedCallback(): void {
		// Chrome leaves an element with no role out of the accessibility tree, and `ariaLive` with it.
		this.internals.role = "group";
		this.internals.ariaLive = "polite";
	}
}
