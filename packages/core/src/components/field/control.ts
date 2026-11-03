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
	"base-field-reset",
];

export function getControl(field: Element | null): Control | undefined {
	return field?.querySelector<Control>(CONTROL) ?? undefined;
}

/**
 * Every control in the field: one, or a group such as radios sharing a name.
 *
 * @param field the field to look in
 * @returns its controls, in document order
 */
export function getControls(field: Element | null): Control[] {
	return field ? [...field.querySelectorAll<Control>(CONTROL)] : [];
}

function isCheckable(control: Control): control is HTMLInputElement {
	return (
		control instanceof HTMLInputElement &&
		(control.type === "checkbox" || control.type === "radio")
	);
}

/**
 * A radio's or checkbox's `value` never changes and is never empty, so what is checked counts.
 *
 * @param controls the field's controls
 * @returns a string that changes whenever their state does
 */
export function snapshot(controls: Control[]): string {
	return JSON.stringify(
		controls.map((control) =>
			isCheckable(control) ? control.checked : control.value,
		),
	);
}

export function isFilled(controls: Control[]): boolean {
	return controls.some((control) =>
		isCheckable(control) ? control.checked : control.value !== "",
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
