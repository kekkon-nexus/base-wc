import { expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "@/components/field/define";
import "@/components/rangegroup/define";

async function mount(controls: string): Promise<{
	field: HTMLBaseFieldElement;
	form: HTMLFormElement;
	inputs: HTMLInputElement[];
	error: HTMLElement;
}> {
	document.body.innerHTML = `
		<form>
			<base-field>
				<fieldset role="radiogroup">
					<legend>Plan</legend>
					${controls}
				</fieldset>
				<base-field-description>Pick one.</base-field-description>
				<base-field-errors>
					<base-field-error match="valueMissing">Choose a plan.</base-field-error>
				</base-field-errors>
			</base-field>
			<button>Submit</button>
		</form>
	`;
	await customElements.whenDefined("base-field");
	await customElements.whenDefined("base-field-error");
	const field = document.querySelector("base-field");
	const form = document.querySelector("form");
	const error = document.querySelector<HTMLElement>("base-field-error");
	if (!field || !form || !error) throw new Error("not mounted");
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
	return {
		field,
		form,
		inputs: [...document.querySelectorAll("input")],
		error,
	};
}

const RADIOS = `
	<label><input type="radio" name="plan" value="free" required> Free</label>
	<label><input type="radio" name="plan" value="pro"> Pro</label>
`;

function at<T>(items: T[], index: number): T {
	const item = items[index];
	if (item === undefined) throw new Error("not mounted");
	return item;
}

it("radios are filled and dirty only once one is checked", async () => {
	const { field, inputs } = await mount(RADIOS);
	expect(field.matches(":state(filled)")).toBe(false);
	expect(field.matches(":state(dirty)")).toBe(false);

	await userEvent.click(at(inputs, 1));

	expect(field.matches(":state(filled)")).toBe(true);
	expect(field.matches(":state(dirty)")).toBe(true);
});

it("touched after any radio loses focus", async () => {
	const { field, inputs } = await mount(RADIOS);

	await userEvent.click(at(inputs, 1));
	await userEvent.tab();

	expect(field.matches(":state(touched)")).toBe(true);
});

it("links the description and errors on every radio", async () => {
	const { inputs } = await mount(RADIOS);

	for (const input of inputs) {
		expect(input.ariaDescribedByElements?.length).toBe(2);
	}
});

it("a submit shows the group's error, marks every radio and focuses the first", async () => {
	const { form, inputs, error } = await mount(RADIOS);

	form.requestSubmit();

	await expect.poll(() => error.hidden).toBe(false);
	expect(document.activeElement).toBe(at(inputs, 0));
	for (const input of inputs) expect(input.ariaInvalid).toBe("true");

	await userEvent.click(at(inputs, 1));
	await expect.poll(() => error.hidden).toBe(true);
	for (const input of inputs)
		expect(input.hasAttribute("aria-invalid")).toBe(false);
});

it("checkboxes count as checked, not by value", async () => {
	const { field, inputs } = await mount(`
		<label><input type="checkbox" name="topics" value="a"> A</label>
		<label><input type="checkbox" name="topics" value="b" checked> B</label>
	`);
	expect(field.matches(":state(filled)")).toBe(true);

	await userEvent.click(at(inputs, 1));

	expect(field.matches(":state(filled)")).toBe(false);
	expect(field.matches(":state(dirty)")).toBe(true);
});

it("a rangegroup's thumbs make the field dirty", async () => {
	document.body.innerHTML = `
		<base-field>
			<base-rangegroup>
				<input type="range" name="low" value="20">
				<input type="range" name="high" value="80">
			</base-rangegroup>
		</base-field>
	`;
	await customElements.whenDefined("base-field");
	await customElements.whenDefined("base-rangegroup");
	const field = document.querySelector("base-field");
	const group = document.querySelector("base-rangegroup");
	const high = document.querySelectorAll("input")[1];
	if (!field || !group || !high) throw new Error("not mounted");
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});

	high.focus();
	await userEvent.keyboard("{ArrowLeft}");

	expect(field.matches(":state(dirty)")).toBe(true);
});
