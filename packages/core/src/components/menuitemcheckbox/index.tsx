import {
	AttachInternals,
	Component,
	Element,
	Prop,
	Watch,
} from "@stencil/core";

import { setState, setUpItem } from "@/utils/menu";

/** A stand-in for `<menuitemcheckbox>`. */
@Component({
	tag: "base-menuitemcheckbox",
	encapsulation: { type: "none" },
})
export class MenuItemCheckbox {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	/** Stays focusable, as the proposal has it, but does not act. */
	@Prop({ reflect: true }) disabled = false;

	/** Live state; `defaultchecked` sets where it starts. */
	@Prop({ mutable: true }) checked = false;

	#abort?: AbortController;

	@Watch("disabled")
	onDisabled(): void {
		this.internals.ariaDisabled = String(this.disabled);
	}

	@Watch("checked")
	onChecked(): void {
		this.internals.ariaChecked = String(this.checked);
		setState(this.internals, "checked", this.checked);
	}

	componentWillLoad(): void {
		if (this.host.hasAttribute("defaultchecked")) this.checked = true;
		// A change before load does not reach the watcher.
		this.onChecked();
	}

	connectedCallback(): void {
		this.#abort = new AbortController();
		setUpItem(
			this.host,
			this.internals,
			"menuitemcheckbox",
			this.#abort.signal,
		);
		this.onDisabled();
		this.onChecked();
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}
}
