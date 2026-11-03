import { Component, Element } from "@stencil/core";

/** A sheet counts as gone once at most this many pixels of it remain in view. */
const GONE = 1;

@Component({
	tag: "base-drawer",
	encapsulation: { type: "none" },
})
export class Drawer {
	@Element() host!: HTMLElement;

	#abort?: AbortController;

	#dialogAbort?: AbortController;

	/** @returns the sheet: every child with content, since the spacer and snap markers are empty */
	#sheet(): Element[] {
		return [...this.host.children].filter((child) => child.hasChildNodes());
	}

	#visible(element: Element, area: DOMRect): number {
		const rect = element.getBoundingClientRect();
		const width =
			Math.min(rect.right, area.right) - Math.max(rect.left, area.left);
		const height =
			Math.min(rect.bottom, area.bottom) - Math.max(rect.top, area.top);
		return Math.max(width, 0) * Math.max(height, 0);
	}

	/**
	 * Scrolls so the sheet is in view, where its snap position takes over.
	 *
	 * @param behavior instant on open, smooth when snapping back
	 */
	#reveal(behavior: ScrollBehavior): void {
		const [first] = this.#sheet();
		if (!first) return;
		const area = this.host.getBoundingClientRect();
		const rect = first.getBoundingClientRect();
		this.host.scrollBy({
			left: rect.left - area.left,
			top: rect.top - area.top,
			behavior,
		});
	}

	#onScrollEnd = (): void => {
		const dialog = this.host.closest("dialog");
		if (!dialog?.open) return;
		const area = this.host.getBoundingClientRect();
		const gone = this.#sheet().every(
			(part) => this.#visible(part, area) <= GONE,
		);
		if (!gone) return;
		// `requestClose()` fires a cancelable `cancel`, so the consumer can keep the drawer open.
		dialog.requestClose();
		// TypeScript narrows `open` to true above, but `cancel` may have kept it.
		if (dialog.hasAttribute("open")) this.#reveal("smooth");
	};

	/**
	 * `scroll-initial-target` is Chrome-only, so the drawer places itself on each open.
	 *
	 * @param event the dialog's toggle
	 */
	#onToggle = (event: Event): void => {
		if ((event as ToggleEvent).newState === "open") this.#reveal("instant");
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
			if (dialog.open) this.#reveal("instant");
		}
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		this.#dialogAbort?.abort();
	}
}
