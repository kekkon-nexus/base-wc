import { AttachInternals, Component, Element } from "@stencil/core";

import { warnWithoutFocusgroup } from "@/utils/dev";
import { ITEMS, rootList } from "@/utils/menu";

const HOVER_DELAY = 100;

type Item = HTMLElement & { disabled?: boolean; checked?: boolean };

/** A stand-in for `<menulist>`. */
@Component({
	tag: "base-menulist",
	encapsulation: { type: "none" },
})
export class Menulist {
	@Element() host!: HTMLElement;

	@AttachInternals({ formAssociated: false }) internals!: ElementInternals;

	#abort?: AbortController;

	#hover?: ReturnType<typeof setTimeout>;

	/** @returns this list's own items, not those of its submenus */
	#items(): Item[] {
		return [...this.host.querySelectorAll<Item>(ITEMS)].filter(
			(item) => item.closest("base-menulist") === this.host,
		);
	}

	#itemOf(target: EventTarget | null): Item | undefined {
		const item = (target as HTMLElement | null)?.closest<Item>(ITEMS);
		return item && this.#items().includes(item) ? item : undefined;
	}

	/**
	 * @param item an item of this list
	 * @returns the submenu list the item opens, if it is a submenu's trigger
	 */
	#submenuOf(item: Item): HTMLElement | undefined {
		const submenu = item.parentElement;
		if (
			submenu?.localName !== "base-submenu" ||
			submenu.querySelector(":scope > base-menuitem") !== item
		) {
			return undefined;
		}
		return (
			submenu.querySelector<HTMLElement>(":scope > base-menulist") ?? undefined
		);
	}

	#open(list: HTMLElement, source: HTMLElement): void {
		if (!list.matches(":popover-open")) list.showPopover({ source });
	}

	/** @returns the open submenu lists directly under this list */
	#openSubmenus(): HTMLElement[] {
		return this.#items()
			.map((item) => this.#submenuOf(item))
			.filter(
				(list): list is HTMLElement => list?.matches(":popover-open") === true,
			);
	}

	#focusFirst = (): void => {
		const first =
			this.host.querySelector<HTMLElement>(":scope [autofocus]") ??
			this.#items()[0];
		first?.focus();
	};

	#onCommand = (event: Event): void => {
		const { command, source } = event as CommandEvent;
		if (command !== "--toggle-menu") return;
		if (this.host.matches(":popover-open")) this.host.hidePopover();
		else this.#open(this.host, source as HTMLElement);
	};

	#onToggle = (event: Event): void => {
		if ((event as ToggleEvent).newState !== "open") return;
		this.#focusFirst();
		// A closed popover is not polyfilled yet, so the check waits for the first open.
		if (__DEV__) warnWithoutFocusgroup(this.host, "base-menulist");
	};

	#onClick = (event: Event): void => {
		const item = this.#itemOf(event.target);
		if (!item || event.defaultPrevented) return;
		if (item.disabled) {
			event.preventDefault();
			event.stopImmediatePropagation();
			return;
		}
		const submenu = this.#submenuOf(item);
		if (submenu) {
			if (submenu.matches(":popover-open")) submenu.hidePopover();
			else this.#open(submenu, item);
			return;
		}
		if (item.localName === "base-menuitemcheckbox") {
			item.checked = !item.checked;
			item.dispatchEvent(new Event("checked", { bubbles: true }));
		} else if (item.localName === "base-menuitemradio" && !item.checked) {
			const group = item.closest("fieldset, base-menulist, base-menubar");
			for (const other of group?.querySelectorAll<Item>("base-menuitemradio") ??
				[]) {
				if (
					other !== item &&
					other.closest("fieldset, base-menulist, base-menubar") === group
				) {
					other.checked = false;
				}
			}
			item.checked = true;
			item.dispatchEvent(new Event("checked", { bubbles: true }));
		}
		rootList(this.host).hidePopover();
	};

	#onKeyDown = (event: KeyboardEvent): void => {
		const item = this.#itemOf(event.target);
		if (!item) return;
		const rtl = getComputedStyle(this.host).direction === "rtl";
		const inlineEnd = rtl ? "ArrowLeft" : "ArrowRight";
		const inlineStart = rtl ? "ArrowRight" : "ArrowLeft";
		const submenu = this.#submenuOf(item);
		if (event.key === inlineEnd && submenu && !item.disabled) {
			event.preventDefault();
			this.#open(submenu, item);
		} else if (
			event.key === inlineStart &&
			this.host.parentElement?.localName === "base-submenu"
		) {
			event.preventDefault();
			const trigger = this.host.parentElement.querySelector<HTMLElement>(
				":scope > base-menuitem",
			);
			this.host.hidePopover();
			trigger?.focus();
		}
	};

	#onPointerOver = (event: PointerEvent): void => {
		const item = this.#itemOf(event.target);
		if (!item || event.pointerType === "touch") return;
		clearTimeout(this.#hover);
		const submenu = this.#submenuOf(item);
		for (const open of this.#openSubmenus()) {
			if (open !== submenu) open.hidePopover();
		}
		if (submenu && !item.disabled) {
			this.#hover = setTimeout(() => {
				this.#open(submenu, item);
			}, HOVER_DELAY);
		}
	};

	/**
	 * Tab leaves the menu, so it closes, as the proposal has it.
	 *
	 * @param event the focus leaving an item
	 */
	#onFocusOut = (event: FocusEvent): void => {
		const next = event.relatedTarget as Node | null;
		const root = rootList(this.host);
		if (next && !root.contains(next) && root.matches(":popover-open")) {
			root.hidePopover();
		}
	};

	connectedCallback(): void {
		this.internals.role = "menu";
		if (!this.host.hasAttribute("popover"))
			this.host.setAttribute("popover", "auto");
		if (!this.host.hasAttribute("focusgroup"))
			this.host.setAttribute("focusgroup", "menu");
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		this.host.addEventListener("command", this.#onCommand, { signal });
		this.host.addEventListener("toggle", this.#onToggle, { signal });
		this.host.addEventListener("click", this.#onClick, { signal });
		this.host.addEventListener("keydown", this.#onKeyDown, { signal });
		this.host.addEventListener("pointerover", this.#onPointerOver, { signal });
		this.host.addEventListener("focusout", this.#onFocusOut, { signal });
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
		clearTimeout(this.#hover);
	}
}
