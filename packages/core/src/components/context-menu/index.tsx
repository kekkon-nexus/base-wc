import { Component, Element } from "@stencil/core";

import { sources } from "@/utils/menu";

/**
 * Opens its menulist from `contextmenu` over its area. Anchor positioning anchors to elements,
 * not points, so the menulist gets the pointer in custom properties for a recipe to place it.
 */
@Component({
	tag: "base-context-menu",
	encapsulation: { type: "none" },
})
export class ContextMenu {
	@Element() host!: HTMLElement;

	#abort?: AbortController;

	#onContextMenu = (event: MouseEvent): void => {
		const list = this.host.querySelector<HTMLElement>(":scope > base-menulist");
		if (!list || list.contains(event.target as Node)) return;
		event.preventDefault();
		list.style.setProperty(
			"--base-context-menu-x",
			`${String(event.clientX)}px`,
		);
		list.style.setProperty(
			"--base-context-menu-y",
			`${String(event.clientY)}px`,
		);
		if (list.matches(":popover-open")) list.hidePopover();
		sources.set(list, this.host);
		list.showPopover({ source: this.host });
	};

	connectedCallback(): void {
		this.#abort = new AbortController();
		this.host.addEventListener("contextmenu", this.#onContextMenu, {
			signal: this.#abort.signal,
		});
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}
}
