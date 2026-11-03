import { Component, Element } from "@stencil/core";

/**
 * A stand-in for `<submenu>`: its first item opens the menulist that follows it. The proposal
 * gives it `display: contents`, which a recipe applies, since no CSS ships.
 */
@Component({
	tag: "base-submenu",
	encapsulation: { type: "none" },
})
export class Submenu {
	@Element() host!: HTMLElement;

	#abort?: AbortController;

	get trigger(): HTMLElement | null {
		return this.host.querySelector(":scope > base-menuitem");
	}

	get list(): HTMLElement | null {
		return this.host.querySelector(":scope > base-menulist");
	}

	connectedCallback(): void {
		const { trigger, list } = this;
		if (!trigger || !list) return;
		trigger.setAttribute("aria-haspopup", "menu");
		trigger.ariaExpanded = "false";
		this.#abort = new AbortController();
		list.addEventListener(
			"toggle",
			(event) => {
				trigger.ariaExpanded = String(event.newState === "open");
			},
			{ signal: this.#abort.signal },
		);
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}
}
