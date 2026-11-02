import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "@/components/field/define";

interface Deferred {
	value: string;
	signal: AbortSignal;
	resolve: (key?: string) => void;
}

type Field = HTMLBaseFieldElement;

async function mount(
	attributes = "",
	count = 1,
): Promise<{
	form: HTMLFormElement;
	fields: Field[];
	inputs: HTMLInputElement[];
	submit: HTMLButtonElement;
	runs: Deferred[];
	submissions: SubmitEvent[];
}> {
	const field = (index: number): string => `
		<base-field ${attributes}>
			<label>Field <input name="field${String(index)}"></label>
			<base-field-errors>
				<base-field-error match="validating">Checking</base-field-error>
				<base-field-error match="taken">Taken</base-field-error>
			</base-field-errors>
		</base-field>`;
	document.body.innerHTML = `
		<form>
			${Array.from({ length: count }, (_, index) => field(index)).join("")}
			<button id="submit" name="action" value="save">Submit</button>
		</form>`;
	const form = document.querySelector("form");
	const submit = document.querySelector<HTMLButtonElement>("#submit");
	if (!form || !submit) throw new Error("not mounted");
	await customElements.whenDefined("base-field");

	const fields = [...document.querySelectorAll("base-field")];
	const runs: Deferred[] = [];
	for (const element of fields) {
		element.validate = (value, { signal }) =>
			new Promise((resolve) => {
				runs.push({ value, signal, resolve });
			});
	}
	const submissions: SubmitEvent[] = [];
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		submissions.push(event);
	});
	return {
		form,
		fields,
		inputs: [...document.querySelectorAll("input")],
		submit,
		runs,
		submissions,
	};
}

function at<T>(items: T[], index: number): T {
	const item = items[index];
	if (item === undefined) throw new Error("not mounted");
	return item;
}

function shown(field: Field): string[] {
	return [...field.querySelectorAll("base-field-error")]
		.filter((error) => !error.hidden)
		.map((error) => error.match ?? "");
}

it("validateon reflects into validateOn, defaulting to input", async () => {
	const { fields } = await mount();
	expect(at(fields, 0).validateOn).toBe("input");

	const { fields: blurFields } = await mount(`validateon="blur"`);
	expect(at(blurFields, 0).validateOn).toBe("blur");
});

it("runs on input and aborts the previous run", async () => {
	const { inputs, runs } = await mount();
	const input = at(inputs, 0);

	await userEvent.type(input, "ab");

	expect(runs.map(({ value }) => value)).toEqual(["a", "ab"]);
	expect(runs[0]?.signal.aborted).toBe(true);
	expect(runs[1]?.signal.aborted).toBe(false);
});

it("a result arriving after its run was aborted is dropped", async () => {
	const { inputs, runs } = await mount();
	const input = at(inputs, 0);
	await userEvent.type(input, "ab");

	runs[0]?.resolve("taken");
	await vi.waitFor(() => {
		expect(input.validationMessage).toBe("validating");
	});
});

it("blur mode runs once per value on leaving the control", async () => {
	const { inputs, runs } = await mount(`validateon="blur"`);
	const input = at(inputs, 0);

	await userEvent.type(input, "a");
	expect(runs).toHaveLength(0);

	await userEvent.tab();
	expect(runs.map(({ value }) => value)).toEqual(["a"]);
});

it("holds validating and the state while a run is pending", async () => {
	const { fields, inputs, runs } = await mount();
	const field = at(fields, 0);
	const input = at(inputs, 0);

	await userEvent.type(input, "a");
	await userEvent.tab();

	expect(field.matches(":state(validating)")).toBe(true);
	expect(input.validationMessage).toBe("validating");
	expect(shown(field)).toEqual(["validating"]);

	runs[0]?.resolve("taken");
	await expect.poll(() => shown(field)).toEqual(["taken"]);
	expect(field.matches(":state(validating)")).toBe(false);
	expect(input.validationMessage).toBe("taken");
});

it("one pending run gives one submission after it resolves", async () => {
	const { inputs, runs, submissions } = await mount();

	await userEvent.type(at(inputs, 0), "a");
	await userEvent.keyboard("{Enter}");
	expect(submissions).toHaveLength(0);

	runs[0]?.resolve();
	await expect.poll(() => submissions.length).toBe(1);
});

it("two pending runs give one submission after the last resolves", async () => {
	const { inputs, runs, submissions } = await mount("", 2);

	await userEvent.type(at(inputs, 0), "a");
	await userEvent.type(at(inputs, 1), "b");
	await userEvent.keyboard("{Enter}");

	runs[0]?.resolve();
	await new Promise((resolve) => {
		setTimeout(resolve, 50);
	});
	expect(submissions).toHaveLength(0);

	runs[1]?.resolve();
	await expect.poll(() => submissions.length).toBe(1);
	await new Promise((resolve) => {
		setTimeout(resolve, 50);
	});
	expect(submissions).toHaveLength(1);
});

it("a run resolving invalid after a blocked submit focuses its control", async () => {
	const { inputs, runs, submissions } = await mount();
	const input = at(inputs, 0);

	await userEvent.type(input, "a");
	await userEvent.keyboard("{Enter}");

	runs[0]?.resolve("taken");

	await expect.poll(() => document.activeElement).toBe(input);
	expect(submissions).toHaveLength(0);
});

it("the focus guard stops the late submit once focus left the form", async () => {
	const { inputs, runs, submissions } = await mount();
	const outside = document.createElement("button");
	document.body.append(outside);

	await userEvent.type(at(inputs, 0), "a");
	await userEvent.keyboard("{Enter}");
	outside.focus();

	runs[0]?.resolve();
	await new Promise((resolve) => {
		setTimeout(resolve, 50);
	});

	expect(submissions).toHaveLength(0);
	expect(document.activeElement).toBe(outside);
});

it("submit mode holds the event and keeps the submitter", async () => {
	const { inputs, submit, runs, submissions } =
		await mount(`validateon="submit"`);
	await userEvent.type(at(inputs, 0), "a");
	expect(runs).toHaveLength(0);

	await userEvent.click(submit);
	await expect.poll(() => runs.length).toBe(1);
	expect(submissions).toHaveLength(0);

	runs[0]?.resolve();
	await expect.poll(() => submissions.length).toBe(1);
	expect(submissions[0]?.submitter).toBe(submit);
});

it("submit mode waits for every field", async () => {
	const { inputs, submit, runs, submissions } = await mount(
		`validateon="submit"`,
		2,
	);
	await userEvent.type(at(inputs, 0), "a");
	await userEvent.type(at(inputs, 1), "b");

	await userEvent.click(submit);
	await expect.poll(() => runs.length).toBe(2);

	runs[0]?.resolve();
	await new Promise((resolve) => {
		setTimeout(resolve, 50);
	});
	expect(submissions).toHaveLength(0);

	runs[1]?.resolve();
	await expect.poll(() => submissions.length).toBe(1);
});

it("submit mode shows and focuses on an invalid result", async () => {
	const { fields, inputs, submit, runs, submissions } =
		await mount(`validateon="submit"`);
	const input = at(inputs, 0);
	await userEvent.type(input, "a");

	await userEvent.click(submit);
	await expect.poll(() => runs.length).toBe(1);
	runs[0]?.resolve("taken");

	await expect.poll(() => shown(at(fields, 0))).toEqual(["taken"]);
	expect(document.activeElement).toBe(input);
	expect(submissions).toHaveLength(0);
});

it("submit mode does not re-run an unchanged value", async () => {
	const { inputs, submit, runs, submissions } =
		await mount(`validateon="submit"`);
	await userEvent.type(at(inputs, 0), "a");
	await userEvent.click(submit);
	await expect.poll(() => runs.length).toBe(1);
	runs[0]?.resolve();
	await expect.poll(() => submissions.length).toBe(1);

	await userEvent.click(submit);

	await expect.poll(() => submissions.length).toBe(2);
	expect(runs).toHaveLength(1);
});

it("submit mode: editing clears the key, and returning restores it", async () => {
	const { inputs, submit, runs } = await mount(`validateon="submit"`);
	const input = at(inputs, 0);
	await userEvent.type(input, "a");
	await userEvent.click(submit);
	await expect.poll(() => runs.length).toBe(1);
	runs[0]?.resolve("taken");
	await expect.poll(() => input.validationMessage).toBe("taken");

	input.setSelectionRange(1, 1);
	await userEvent.keyboard("b");
	expect(input.validationMessage).toBe("");

	await userEvent.keyboard("{Backspace}");
	expect(input.validationMessage).toBe("taken");
});

it("submit mode skips the check for formnovalidate", async () => {
	const { inputs, submit, runs, submissions } =
		await mount(`validateon="submit"`);
	submit.formNoValidate = true;
	await userEvent.type(at(inputs, 0), "a");

	await userEvent.click(submit);

	await expect.poll(() => submissions.length).toBe(1);
	expect(runs).toHaveLength(0);
});

it("a valid result leaves a consumer's failing key in place", async () => {
	const { inputs, runs } = await mount();
	const input = at(inputs, 0);
	await userEvent.type(input, "a");

	input.setCustomValidity("reserved");
	runs[0]?.resolve();

	await new Promise((resolve) => {
		setTimeout(resolve, 50);
	});
	expect(input.validationMessage).toBe("reserved");
});

it("field's result goes in once the consumer clears its key", async () => {
	const { inputs, runs } = await mount();
	const input = at(inputs, 0);
	input.addEventListener("input", () => {
		input.setCustomValidity(input.value === "a" ? "reserved" : "");
	});

	await userEvent.type(input, "a");
	expect(input.validationMessage).toBe("reserved");

	await userEvent.type(input, "b");
	expect(input.validationMessage).toBe("validating");

	at(runs, 1).resolve("taken");
	await expect.poll(() => input.validationMessage).toBe("taken");
});

it("an empty string from validate means valid", async () => {
	const { inputs, runs } = await mount();
	const input = at(inputs, 0);
	await userEvent.type(input, "a");

	runs[0]?.resolve("");

	await expect.poll(() => input.validity.valid).toBe(true);
});

it("an aborted run's rejection is dropped without a report", async () => {
	const { fields, inputs } = await mount();
	const errors: unknown[] = [];
	const onError = (event: ErrorEvent): void => {
		event.preventDefault();
		errors.push(event.error);
	};
	globalThis.addEventListener("error", onError);
	at(fields, 0).validate = (_value, { signal }) =>
		new Promise((_resolve, reject) => {
			signal.addEventListener("abort", () => {
				reject(signal.reason as Error);
			});
		});

	await userEvent.type(at(inputs, 0), "ab");
	await new Promise((resolve) => {
		setTimeout(resolve, 50);
	});
	globalThis.removeEventListener("error", onError);

	expect(errors).toEqual([]);
});

it("a failing validate is reported and leaves the control valid", async () => {
	const { fields, inputs } = await mount();
	const failure = new Error("network");
	const errors: unknown[] = [];
	const onError = (event: ErrorEvent): void => {
		event.preventDefault();
		errors.push(event.error);
	};
	globalThis.addEventListener("error", onError);
	at(fields, 0).validate = () => Promise.reject(failure);

	await userEvent.type(at(inputs, 0), "a");
	await expect.poll(() => errors).toEqual([failure]);
	globalThis.removeEventListener("error", onError);

	expect(at(inputs, 0).validity.valid).toBe(true);
});

it("validatedelay runs only the last value, holding validating meanwhile", async () => {
	const { inputs, runs } = await mount(`validatedelay="50"`);
	const input = at(inputs, 0);

	await userEvent.type(input, "ab");
	expect(input.validationMessage).toBe("validating");

	await expect.poll(() => runs.map(({ value }) => value)).toEqual(["ab"]);
});
