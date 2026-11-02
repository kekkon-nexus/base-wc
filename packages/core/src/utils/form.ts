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
