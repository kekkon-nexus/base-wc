import { AttachInternals, Component, Element } from "@stencil/core";

import { warn } from "@/utils/dev";

/** A stand-in for `<toolbar>`: delete it or make it a polyfill once that ships. */
@Component({
	tag: "base-toolbar",
	encapsulation: { type: "none" },
})
export class Toolbar {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	#abort?: AbortController;

	/**
	 * Keeps `aria-disabled` items focusable but stops them acting, Enter and Space included.
	 *
	 * @param event the click
	 */
	#onClick = (event: Event): void => {
		const item = (event.target as HTMLElement).closest(
			'[aria-disabled="true"]',
		);
		if (item && this.host.contains(item)) {
			event.preventDefault();
			event.stopImmediatePropagation();
		}
	};

	/**
	 * The polyfill adds no `focusGroup` property, so it is told apart by the `tabindex="-1"` it
	 * writes on items other than the entry one.
	 */
	#checkFocusgroup(): void {
		if ("focusGroup" in HTMLElement.prototype) return;
		setTimeout(() => {
			if (!this.host.querySelector('[tabindex="-1"]')) {
				warn(
					"<base-toolbar> needs focusgroup, which this browser lacks: load @microsoft/focusgroup-polyfill.",
				);
			}
		}, 0);
	}

	connectedCallback(): void {
		this.internals.role = "toolbar";
		if (!this.host.hasAttribute("focusgroup")) {
			this.host.setAttribute("focusgroup", "toolbar");
		}
		this.#abort = new AbortController();
		this.host.addEventListener("click", this.#onClick, {
			capture: true,
			signal: this.#abort.signal,
		});
		if (__DEV__) this.#checkFocusgroup();
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}
}
