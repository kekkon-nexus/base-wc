import type { Control } from "@/components/field/control";

const warned = new Set<string>();

export function warn(message: string): void {
	if (warned.has(message)) return;
	warned.add(message);
	console.warn(`[base-wc] ${message}`);
}

const STEPPED_TYPES = new Set([
	"number",
	"date",
	"month",
	"week",
	"time",
	"datetime-local",
]);

function constraintKeys(control: Control): string[] {
	const { type } = control;
	const has = (name: string): boolean => control.hasAttribute(name);
	const keys: string[] = [];
	if (has("required")) keys.push("valueMissing");
	if (type === "email" || type === "url") keys.push("typeMismatch");
	if (has("pattern")) keys.push("patternMismatch");
	if (has("minlength")) keys.push("tooShort");
	if (has("maxlength")) keys.push("tooLong");
	if (has("min")) keys.push("rangeUnderflow");
	if (has("max")) keys.push("rangeOverflow");
	if (
		type !== "range" &&
		control.getAttribute("step") !== "any" &&
		(has("step") || STEPPED_TYPES.has(type))
	) {
		keys.push("stepMismatch");
	}
	if (STEPPED_TYPES.has(type) || type === "email") keys.push("badInput");
	return keys;
}

/**
 * @param field the field holding the control
 * @param control the control whose constraints need a message
 */
export function warnMissingErrors(field: Element, control: Control): void {
	const errors = new Set(
		[...field.querySelectorAll("base-field-error")].map(
			(error) => error.getAttribute("match") ?? "",
		),
	);
	if (errors.has("")) return;
	for (const key of constraintKeys(control)) {
		if (!errors.has(key)) {
			warn(`<${control.localName}> can fail "${key}", which has no error.`);
		}
	}
}

/**
 * The polyfill adds no `focusGroup` property, so it is told apart by the `tabindex="-1"` it
 * writes on items other than the entry one, a task after connect.
 *
 * @param scope the element holding the focusgroup items
 * @param tag the component that needs focusgroup, for the message
 */
export function warnWithoutFocusgroup(scope: Element, tag: string): void {
	if ("focusGroup" in HTMLElement.prototype) return;
	setTimeout(() => {
		if (!scope.querySelector('[tabindex="-1"]')) {
			warn(
				`<${tag}> needs focusgroup, which this browser lacks: load @microsoft/focusgroup-polyfill.`,
			);
		}
	}, 0);
}
