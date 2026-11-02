/**
 * A control's `name` hides any member of the same name on its form, so every read and call on
 * a form goes through a prototype.
 *
 * @param form the form to submit
 * @param submitter the button to submit with
 */
export function requestSubmit(
	form: HTMLFormElement,
	submitter?: HTMLElement | null,
): void {
	HTMLFormElement.prototype.requestSubmit.call(form, submitter ?? undefined);
}

export function hasAttribute(element: Element, name: string): boolean {
	return Element.prototype.hasAttribute.call(element, name);
}

export function addListener(
	form: HTMLFormElement,
	type: string,
	listener: EventListener,
	options: AddEventListenerOptions,
): void {
	EventTarget.prototype.addEventListener.call(form, type, listener, options);
}

export function checkValidity(form: HTMLFormElement): boolean {
	return HTMLFormElement.prototype.checkValidity.call(form);
}

/**
 * Matches `name` or `id`, including controls outside the tag linked with `form="id"`.
 *
 * @param form the form to look in
 * @param name the control's name
 * @returns the control, or the first of a repeated name such as a radio group
 */
export function namedControl(
	form: HTMLFormElement,
	name: string,
): Element | undefined {
	const elements = Object.getOwnPropertyDescriptor(
		HTMLFormElement.prototype,
		"elements",
	)?.get?.call(form) as HTMLFormControlsCollection;
	const item = elements.namedItem(name);
	return (item instanceof RadioNodeList ? item[0] : item) ?? undefined;
}

/**
 * `reset` fires before the reset and can be canceled, and a microtask would run before later
 * listeners, so the outcome is read in a task.
 *
 * @param form the form to watch
 * @param callback runs once a reset went through
 * @param signal stops watching
 */
export function afterReset(
	form: HTMLFormElement,
	callback: () => void,
	signal: AbortSignal,
): void {
	addListener(
		form,
		"reset",
		(event) => {
			setTimeout(() => {
				if (!event.defaultPrevented) callback();
			}, 0);
		},
		{ signal },
	);
}
