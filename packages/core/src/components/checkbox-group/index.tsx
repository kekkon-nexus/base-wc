import { Component, Element } from "@stencil/core";

import { warn } from "@/utils/dev";
import { afterReset } from "@/utils/form";

type Status = "on" | "off" | "mixed";

@Component({
	tag: "base-checkbox-group",
	encapsulation: { type: "none" },
})
export class CheckboxGroup {
	@Element() host!: HTMLElement;

	#abort?: AbortController;

	#parentAbort?: AbortController;

	#parent?: HTMLInputElement;

	/** Where the next parent click goes from: the cycle is checked, unchecked, mixed. */
	#status: Status = "off";

	/** The last combination picked by hand, restored by the mixed step. */
	#saved: boolean[] = [];

	/** Set while the group checks children itself, so it does not save that as a hand pick. */
	#applying = false;

	#observer = new MutationObserver(() => {
		this.#sync();
	});

	#children(): HTMLInputElement[] {
		return [
			...this.host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
		].filter((input) => input !== this.#parent);
	}

	#findParent(): HTMLInputElement | undefined {
		const { id } = this.host;
		if (!id) return undefined;
		const root = this.host.getRootNode() as Document | ShadowRoot;
		return (
			root.querySelector<HTMLInputElement>(
				`input[type="checkbox"][aria-controls~="${CSS.escape(id)}"]`,
			) ?? undefined
		);
	}

	#paint(): void {
		const parent = this.#parent;
		if (!parent) return;
		const children = this.#children();
		const checked = children.filter((child) => child.checked).length;
		parent.checked = children.length > 0 && checked === children.length;
		parent.indeterminate = checked > 0 && checked < children.length;
	}

	/** Takes the current combination as the hand-picked one. */
	#save(): void {
		const states = this.#children().map((child) => child.checked);
		this.#saved = states;
		const count = states.filter(Boolean).length;
		if (count === 0) this.#status = "off";
		else if (count === states.length) this.#status = "on";
		else this.#status = "mixed";
	}

	#isMixed(states: boolean[]): boolean {
		return states.some(Boolean) && !states.every(Boolean);
	}

	#apply(target: (child: HTMLInputElement, index: number) => boolean): void {
		this.#applying = true;
		for (const [index, child] of this.#children().entries()) {
			const next = child.disabled ? child.checked : target(child, index);
			if (next !== child.checked) {
				child.checked = next;
				child.dispatchEvent(new Event("input", { bubbles: true }));
				child.dispatchEvent(new Event("change", { bubbles: true }));
			}
		}
		this.#applying = false;
	}

	#onParentChange = (): void => {
		let next: Status;
		if (this.#status === "mixed") next = "on";
		else if (this.#status === "on") next = "off";
		else next = this.#isMixed(this.#saved) ? "mixed" : "on";

		if (next === "mixed")
			this.#apply((_, index) => this.#saved[index] ?? false);
		else this.#apply(() => next === "on");
		this.#status = next;
		this.#paint();
	};

	#onChildChange = (event: Event): void => {
		if (this.#applying || event.target === this.#parent) return;
		if (!this.#children().includes(event.target as HTMLInputElement)) return;
		this.#save();
		this.#paint();
	};

	#sync(): void {
		const parent = this.#findParent();
		if (parent !== this.#parent) {
			this.#parentAbort?.abort();
			this.#parent = parent;
			if (parent) {
				this.#parentAbort = new AbortController();
				parent.addEventListener("change", this.#onParentChange, {
					signal: this.#parentAbort.signal,
				});
			}
		}
		this.#save();
		this.#paint();
	}

	connectedCallback(): void {
		if (__DEV__ && !this.host.id) {
			warn("<base-checkbox-group> needs an id for its parent's aria-controls.");
		}
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		this.host.addEventListener("change", this.#onChildChange, { signal });
		this.#observer.observe(this.host, { childList: true, subtree: true });
		this.#sync();
		const form = this.#children()[0]?.form;
		if (form) {
			afterReset(
				form,
				() => {
					this.#sync();
				},
				signal,
			);
		}
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		this.#parentAbort?.abort();
		this.#observer.disconnect();
		this.#parent = undefined;
	}
}
