export const ITEMS = "base-menuitem, base-menuitemcheckbox, base-menuitemradio";

/** What opened each menulist, set by whoever opens it, to return focus there. */
export const sources: WeakMap<HTMLElement, HTMLElement> = new WeakMap<
	HTMLElement,
	HTMLElement
>();

/**
 * Shared by the three item elements: they are focusable, take Enter and Space as a click, and
 * stay focusable when disabled, which the proposal reflects to `aria-disabled`.
 *
 * @param host the item
 * @param internals its internals
 * @param role its role
 * @param signal stops the listeners
 */
export function setUpItem(
	host: HTMLElement,
	internals: ElementInternals,
	role: string,
	signal: AbortSignal,
): void {
	internals.role = role;
	if (!host.hasAttribute("tabindex")) host.setAttribute("tabindex", "0");
	host.addEventListener(
		"keydown",
		(event) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			host.click();
		},
		{ signal },
	);
}

export function setState(
	internals: ElementInternals,
	name: string,
	on: boolean,
): void {
	if (on) internals.states.add(name);
	else internals.states.delete(name);
}

/**
 * @param list a menulist
 * @returns the outermost menulist it is nested in, through submenus
 */
export function rootList(list: HTMLElement): HTMLElement {
	let root = list;
	let parent = list.parentElement?.closest<HTMLElement>("base-menulist");
	while (parent) {
		root = parent;
		parent = parent.parentElement?.closest<HTMLElement>("base-menulist");
	}
	return root;
}
