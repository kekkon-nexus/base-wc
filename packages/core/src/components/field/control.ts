export type Control =
	| HTMLInputElement
	| HTMLSelectElement
	| HTMLTextAreaElement;

const CONTROL = "input, select, textarea";

/**
 * `invalid` does not bubble, so it is listened for in the capture phase. The rest bubble,
 * which puts field after a consumer's listener on the control, so a `setCustomValidity()` there is seen.
 */
export const EVENTS: string[] = [
	"input",
	"change",
	"focusout",
	"invalid",
	"base-field-validity",
];

export function getControl(field: Element | null): Control | undefined {
	return field?.querySelector<Control>(CONTROL) ?? undefined;
}

export function setState(
	internals: ElementInternals,
	name: string,
	on: boolean,
): void {
	if (on) internals.states.add(name);
	else internals.states.delete(name);
}
