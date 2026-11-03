import { AttachInternals, Component, Element } from "@stencil/core";

import { warnWithoutFocusgroup } from "@/utils/dev";
import { sources } from "@/utils/menu";

/** A stand-in for `<menubar>`. */
@Component({
	tag: "base-menubar",
	encapsulation: { type: "none" },
})
export class Menubar {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	#abort?: AbortController;

	/** @returns the top-level items, in order */
	#items(): HTMLElement[] {
		return [
			...this.host.querySelectorAll<HTMLElement>(
				":scope > base-menuitem, :scope > base-submenu > base-menuitem",
			),
		];
	}

	#listOf(item: HTMLElement): HTMLElement | undefined {
		return item.parentElement?.localName === "base-submenu"
			? (item.parentElement.querySelector<HTMLElement>(
					":scope > base-menulist",
				) ?? undefined)
			: undefined;
	}

	#openList(): HTMLElement | undefined {
		return this.#items()
			.map((item) => this.#listOf(item))
			.find((list) => list?.matches(":popover-open"));
	}

	#open(item: HTMLElement): void {
		const list = this.#listOf(item);
		if (!list || list.matches(":popover-open")) return;
		sources.set(list, item);
		list.showPopover({ source: item });
	}

	/**
	 * Moves to the next or previous top-level item, opening its menu when one was open (APG).
	 *
	 * @param from the top-level item to move from
	 * @param step 1 or -1
	 */
	#move(from: HTMLElement, step: number): void {
		const items = this.#items();
		const next =
			items[(items.indexOf(from) + step + items.length) % items.length];
		if (!next) return;
		next.focus();
		this.#open(next);
	}

	#onClick = (event: Event): void => {
		const item = this.#items().find((each) => each === event.target);
		const list = item && this.#listOf(item);
		if (!item || !list) return;
		if (list.matches(":popover-open")) list.hidePopover();
		else this.#open(item);
	};

	#onKeyDown = (event: KeyboardEvent): void => {
		const rtl = getComputedStyle(this.host).direction === "rtl";
		const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[
			event.key
		];
		const target = event.target as HTMLElement;
		const items = this.#items();
		if (items.includes(target)) {
			if (event.key === "ArrowDown" && this.#listOf(target)) {
				event.preventDefault();
				this.#open(target);
			}
			return;
		}
		// Inside a top-level menu: the inline arrows move to the next menu, unless they open or close a submenu.
		const list = target.closest<HTMLElement>("base-menulist");
		const trigger = list?.parentElement?.querySelector<HTMLElement>(
			":scope > base-menuitem",
		);
		if (
			step === undefined ||
			!trigger ||
			!items.includes(trigger) ||
			event.defaultPrevented
		) {
			return;
		}
		event.preventDefault();
		list?.hidePopover();
		this.#move(trigger, step);
	};

	/**
	 * Once one menu is open, pointing at another top-level item switches to it.
	 *
	 * @param event the pointer over an item
	 */
	#onPointerOver = (event: PointerEvent): void => {
		const item = this.#items().find((each) => each === event.target);
		const open = this.#openList();
		if (!item || !open || this.#listOf(item) === open) return;
		open.hidePopover();
		this.#open(item);
	};

	connectedCallback(): void {
		this.internals.role = "menubar";
		if (!this.host.hasAttribute("focusgroup"))
			this.host.setAttribute("focusgroup", "menubar");
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		this.host.addEventListener("click", this.#onClick, { signal });
		this.host.addEventListener("keydown", this.#onKeyDown, { signal });
		this.host.addEventListener("pointerover", this.#onPointerOver, { signal });
		if (__DEV__) warnWithoutFocusgroup(this.host, "base-menubar");
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}
}
