import { addListener, hasAttribute, requestSubmit } from "@/utils/form";

export interface SubmitCheck {
	/** Whether the current value still needs checking at submit. */
	stale: () => boolean;
	/** Resolves `true` when the check passed. */
	check: () => Promise<boolean>;
}

const checks = new WeakMap<HTMLFormElement, Set<SubmitCheck>>();

async function resubmit(
	form: HTMLFormElement,
	stale: SubmitCheck[],
	submitter: HTMLElement | null,
): Promise<void> {
	const results = await Promise.all(stale.map(({ check }) => check()));
	if (results.every(Boolean)) requestSubmit(form, submitter);
}

function onSubmit(event: Event): void {
	const form = event.currentTarget as HTMLFormElement;
	const { submitter } = event as SubmitEvent;
	const stale = [...(checks.get(form) ?? [])].filter(({ stale }) => stale());
	if (
		stale.length === 0 ||
		hasAttribute(form, "novalidate") ||
		(submitter && hasAttribute(submitter, "formnovalidate"))
	) {
		return;
	}

	event.preventDefault();
	event.stopImmediatePropagation();
	resubmit(form, stale, submitter).catch(reportError);
}

/**
 * One listener per form: per field, the first `stopImmediatePropagation()` would stop the others.
 *
 * @param form the form to hold submission on
 * @param check the field's check
 * @returns a function that removes the check
 */
export function addSubmitCheck(
	form: HTMLFormElement,
	check: SubmitCheck,
): () => void {
	let set = checks.get(form);
	if (!set) {
		set = new Set();
		checks.set(form, set);
		addListener(form, "submit", onSubmit, { capture: true });
	}
	set.add(check);
	return () => set.delete(check);
}
