import {
	AttachInternals,
	Component,
	Element,
	Prop,
	Watch,
} from "@stencil/core";

import { setUpItem } from "@/utils/menu";

/** A stand-in for `<menuitem>`. */
@Component({
	tag: "base-menuitem",
	encapsulation: { type: "none" },
})
export class MenuItem {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	/** Stays focusable, as the proposal has it, but does not act. */
	@Prop({ reflect: true }) disabled = false;

	#abort?: AbortController;

	@Watch("disabled")
	onDisabled(): void {
		this.internals.ariaDisabled = String(this.disabled);
	}

	connectedCallback(): void {
		this.#abort = new AbortController();
		setUpItem(this.host, this.internals, "menuitem", this.#abort.signal);
		this.onDisabled();
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}
}
