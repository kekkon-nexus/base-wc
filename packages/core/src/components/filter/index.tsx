import { Component, Element } from "@stencil/core";

const MODES = new Set(["includes", "startswith", "pattern"]);

/**
 * A stand-in for filterable select (option A) and the datalist combobox: the input named by
 * `filter` narrows the options of the `<select>` or `role="listbox"` element it points at.
 */
@Component({
	tag: "base-filter",
	encapsulation: { type: "none" },
})
export class Filter {
	@Element() host!: HTMLElement;

	#abort?: AbortController;

	/** Options the filter hid, so clearing it leaves options the consumer hid alone. */
	#hidden = new Set<HTMLElement>();

	#active?: HTMLElement;

	get #input(): HTMLInputElement | undefined {
		return (
			this.host.querySelector<HTMLInputElement>("input[filter]") ?? undefined
		);
	}

	get #list(): HTMLElement | undefined {
		const id = this.#input?.getAttribute("filter");
		if (!id) return undefined;
		return (
			this.host.querySelector<HTMLElement>(`#${CSS.escape(id)}`) ?? undefined
		);
	}

	#options(): HTMLElement[] {
		return [
			...(this.#list?.querySelectorAll<HTMLElement>(
				'option, [role="option"]',
			) ?? []),
		];
	}

	#visible(): HTMLElement[] {
		return this.#options().filter(
			(option) => !option.hidden && !(option as HTMLOptionElement).disabled,
		);
	}

	#popover(): HTMLElement | undefined {
		return this.#list?.closest<HTMLElement>("[popover]") ?? undefined;
	}

	#show(): void {
		const popover = this.#popover();
		const input = this.#input;
		if (popover && input && !popover.matches(":popover-open")) {
			popover.showPopover({ source: input });
		}
		if (input && popover) input.ariaExpanded = "true";
	}

	#hide(): void {
		const popover = this.#popover();
		if (popover?.matches(":popover-open")) popover.hidePopover();
		const input = this.#input;
		if (input && popover) input.ariaExpanded = "false";
	}

	#matches(text: string, query: string, input: HTMLInputElement): boolean {
		const mode = input.getAttribute("search") ?? "includes";
		const value = text.toLocaleLowerCase();
		const typed = query.toLocaleLowerCase();
		if (!MODES.has(mode) || mode === "includes") return value.includes(typed);
		if (mode === "startswith") return value.startsWith(typed);
		try {
			return new RegExp(`^(?:${query})`, "iu").test(text);
		} catch {
			return true;
		}
	}

	#setActive(option?: HTMLElement): void {
		this.#active?.removeAttribute("activeoption");
		this.#active = option;
		option?.setAttribute("activeoption", "");
		option?.scrollIntoView({ block: "nearest" });
		const input = this.#input;
		if (input && option) input.ariaActiveDescendantElement = option;
		// Writing the attribute clears an element set through the property.
		else input?.removeAttribute("aria-activedescendant");
	}

	#filter(input: HTMLInputElement): void {
		const event = Object.assign(
			new Event("beforefilter", { cancelable: true }),
			{
				query: input.value,
			},
		);
		const run = input.dispatchEvent(event);
		for (const option of this.#hidden) option.hidden = false;
		this.#hidden.clear();
		if (run && input.value !== "") {
			for (const option of this.#options()) {
				if (option.hidden) continue;
				if (!this.#matches(option.textContent.trim(), input.value, input)) {
					option.hidden = true;
					this.#hidden.add(option);
				}
			}
		}
		if (this.#active?.hidden) this.#setActive(undefined);
	}

	#choose(option: HTMLElement): void {
		const input = this.#input;
		const list = this.#list;
		if (!input || !list) return;
		const value =
			(option as HTMLOptionElement).value || option.textContent.trim();
		if (list instanceof HTMLSelectElement) {
			list.value = value;
			list.dispatchEvent(new Event("input", { bubbles: true }));
			list.dispatchEvent(new Event("change", { bubbles: true }));
		} else {
			input.value = value;
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}
		this.#setActive(undefined);
		this.#hide();
	}

	#onInput = (event: Event): void => {
		const input = this.#input;
		if (!input || event.target !== input) return;
		this.#filter(input);
		this.#show();
	};

	#onKeyDown = (event: KeyboardEvent): void => {
		const input = this.#input;
		if (!input || event.target !== input) return;
		const visible = this.#visible();
		const index = this.#active ? visible.indexOf(this.#active) : -1;
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			this.#show();
			const step = event.key === "ArrowDown" ? 1 : -1;
			const next = visible[(index + step + visible.length) % visible.length];
			this.#setActive(index === -1 && step < 0 ? visible.at(-1) : next);
		} else if (event.key === "Enter" && this.#active) {
			event.preventDefault();
			this.#choose(this.#active);
		} else if (event.key === "Escape") {
			this.#setActive(undefined);
			this.#hide();
		}
	};

	/**
	 * Focus stays in the input, so a press on an option must not take it.
	 *
	 * @param event the press
	 */
	#onPointerDown = (event: PointerEvent): void => {
		if (this.#optionOf(event.target)) event.preventDefault();
	};

	#onClick = (event: Event): void => {
		const option = this.#optionOf(event.target);
		if (option) this.#choose(option);
	};

	/**
	 * @param target an event target
	 * @returns the option it is in, if that option belongs to this filter's list
	 */
	#optionOf(target: EventTarget | null): HTMLElement | undefined {
		const option = (target as HTMLElement | null)?.closest<HTMLElement>(
			'option, [role="option"]',
		);
		return option && this.#options().includes(option) ? option : undefined;
	}

	connectedCallback(): void {
		const input = this.#input;
		const list = this.#list;
		if (input && list) {
			input.ariaControlsElements = [list];
			input.ariaAutoComplete = "list";
			if (this.#popover()) input.ariaExpanded = "false";
		}
		this.#abort = new AbortController();
		const { signal } = this.#abort;
		this.host.addEventListener("input", this.#onInput, { signal });
		this.host.addEventListener("keydown", this.#onKeyDown, { signal });
		this.host.addEventListener("pointerdown", this.#onPointerDown, { signal });
		this.host.addEventListener("click", this.#onClick, { signal });
	}

	disconnectedCallback(): void {
		this.#abort?.abort();
	}
}
