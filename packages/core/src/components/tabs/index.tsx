import { Component, Element, Prop } from "@stencil/core";

import { warnWithoutFocusgroup } from "@/utils/dev";

type Change = [HTMLElement, "open" | "closed", "open" | "closed"];

@Component({
	tag: "base-tabs",
	encapsulation: { type: "none" },
})
export class Tabs {
	@Element() host!: HTMLElement;

	/** `automatic` selects a tab when it gets focus; `manual` only on click, Enter or Space. */
	@Prop() activation: "automatic" | "manual" = "automatic";

	/** Pairs tabs and panels by the tabs' own `aria-controls`, and links nothing itself. */
	@Prop({ attribute: "manualaria" }) manualAria = false;

	#abort?: AbortController;

	#selected?: HTMLElement;

	#observer = new MutationObserver(() => {
		this.#sync();
	});

	/** @returns the tablist, a direct child only, so a `base-tabs` nested in a panel keeps its own */
	#tablist(): HTMLElement | null {
		return this.host.querySelector(':scope > [role="tablist"]');
	}

	#pairs(): [HTMLElement, HTMLElement][] {
		const tabs = [
			...(this.#tablist()?.querySelectorAll<HTMLElement>(
				':scope > [role="tab"]',
			) ?? []),
		];
		const panels = [
			...this.host.querySelectorAll<HTMLElement>(':scope > [role="tabpanel"]'),
		];
		if (this.manualAria) {
			return tabs.flatMap((tab) => {
				const panel = panels.find(
					({ id }) => id !== "" && id === tab.getAttribute("aria-controls"),
				);
				return panel ? [[tab, panel] as [HTMLElement, HTMLElement]] : [];
			});
		}
		return tabs.flatMap((tab, index) => {
			const panel = panels[index];
			return panel ? [[tab, panel] as [HTMLElement, HTMLElement]] : [];
		});
	}

	#show(panel: HTMLElement): void {
		for (const [tab, each] of this.#pairs()) {
			const open = each === panel;
			tab.ariaSelected = String(open);
			if (open) {
				tab.setAttribute("focusgroupstart", "");
				each.removeAttribute("hidden");
			} else {
				tab.removeAttribute("focusgroupstart");
				// Find-in-page can still reach the text and reveals it through `beforematch`.
				each.setAttribute("hidden", "until-found");
			}
		}
		this.#selected = panel;
	}

	/**
	 * Fires `beforetoggle`, cancelable, then `toggle` a task later, on the panel closing and the
	 * one opening, as a popover or `<details>` does. Neither bubbles.
	 *
	 * @param panel the panel to open
	 */
	#select(panel: HTMLElement): void {
		const previous = this.#selected;
		if (panel === previous) return;
		const changes: Change[] = [[panel, "closed", "open"]];
		if (previous) changes.unshift([previous, "open", "closed"]);
		for (const [target, oldState, newState] of changes) {
			const allowed = target.dispatchEvent(
				new ToggleEvent("beforetoggle", {
					cancelable: true,
					oldState,
					newState,
				}),
			);
			if (!allowed) return;
		}
		this.#show(panel);
		setTimeout(() => {
			for (const [target, oldState, newState] of changes) {
				target.dispatchEvent(new ToggleEvent("toggle", { oldState, newState }));
			}
		}, 0);
	}

	#panelOf(target: EventTarget | null): HTMLElement | undefined {
		return this.#pairs().find(([tab]) => tab === target)?.[1];
	}

	#onClick = (event: Event): void => {
		const panel = this.#panelOf(
			(event.target as HTMLElement).closest('[role="tab"]'),
		);
		if (panel) this.#select(panel);
	};

	#onFocusIn = (event: Event): void => {
		if (this.activation !== "automatic") return;
		const panel = this.#panelOf(event.target);
		if (panel) this.#select(panel);
	};

	#onBeforeMatch = (event: Event): void => {
		const pair = this.#pairs().find(([, panel]) => panel === event.target);
		if (pair) this.#select(pair[1]);
	};

	#sync(): void {
		const pairs = this.#pairs();
		if (!this.manualAria) {
			for (const [tab, panel] of pairs) {
				tab.ariaControlsElements = [panel];
				panel.ariaLabelledByElements = [tab];
			}
		}
		const panels = pairs.map(([, panel]) => panel);
		const open =
			(this.#selected && panels.includes(this.#selected)
				? this.#selected
				: panels.find((panel) => panel.hasAttribute("defaultopen"))) ??
			panels[0];
		if (open) this.#show(open);
	}

	connectedCallback(): void {
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		this.host.addEventListener("click", this.#onClick, { signal });
		this.host.addEventListener("focusin", this.#onFocusIn, { signal });
		this.host.addEventListener("beforematch", this.#onBeforeMatch, {
			capture: true,
			signal,
		});
		this.#observer.observe(this.host, { childList: true, subtree: true });
		this.#sync();
		const tablist = this.#tablist();
		if (__DEV__ && tablist) warnWithoutFocusgroup(tablist, "base-tabs");
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		this.#observer.disconnect();
	}
}
