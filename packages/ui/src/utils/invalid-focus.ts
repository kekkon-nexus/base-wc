import type { Control } from "@/components/field/control";

const round = new WeakSet<Element>();

function mayFocus(scope: Element): boolean {
	const active = document.activeElement;
	return (
		active === null ||
		active === document.body ||
		Node.prototype.contains.call(scope, active)
	);
}

/**
 * One validation pass fires `invalid` in tree order, so the first event of a round is the first
 * invalid control in document order.
 *
 * @param control the control `invalid` fired on
 * @param field the field holding it, the focus scope when it has no form owner
 */
export function focusFirstInvalid(control: Control, field: Element): void {
	const key = control.form ?? control;
	if (round.has(key)) return;
	round.add(key);
	// Not a microtask: on a real click the browser fires `invalid` itself, so microtasks run between
	// the events of one pass. The whole pass fits in one task.
	setTimeout(() => round.delete(key), 0);

	if (!mayFocus(control.form ?? field)) return;
	control.focus();
	if (!(control instanceof HTMLSelectElement)) control.select();
}
