import { Component, Element } from "@stencil/core";

import { reveal, swipedAway } from "@/utils/swipe";

@Component({
	tag: "base-drawer",
	encapsulation: { type: "none" },
})
export class Drawer {
	@Element() host!: HTMLElement;

	#abort?: AbortController;

	#dialogAbort?: AbortController;

	#onScrollEnd = (): void => {
		const dialog = this.host.closest("dialog");
		if (!dialog?.open || !swipedAway(this.host)) return;
		// `requestClose()` fires a cancelable `cancel`, so the consumer can keep the drawer open.
		dialog.requestClose();
		// TypeScript narrows `open` to true above, but `cancel` may have kept it.
		if (dialog.hasAttribute("open")) reveal(this.host, "smooth");
	};

	/**
	 * `scroll-initial-target` is Chrome-only, so the drawer places itself on each open.
	 *
	 * @param event the dialog's toggle
	 */
	#onToggle = (event: Event): void => {
		if ((event as ToggleEvent).newState === "open")
			reveal(this.host, "instant");
	};

	connectedCallback(): void {
		this.#abort = new AbortController();
		this.host.addEventListener("scrollend", this.#onScrollEnd, {
			signal: this.#abort.signal,
		});
		const dialog = this.host.closest("dialog");
		if (dialog) {
			this.#dialogAbort = new AbortController();
			dialog.addEventListener("toggle", this.#onToggle, {
				signal: this.#dialogAbort.signal,
			});
			if (dialog.open) reveal(this.host, "instant");
		}
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		this.#dialogAbort?.abort();
	}
}
