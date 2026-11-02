import { expect, it } from "vite-plus/test";
import { commands, server, userEvent } from "vite-plus/test/browser";

import "@/components/field/define";

async function mount(control: string): Promise<{
	field: HTMLElement;
	input: HTMLInputElement;
	form: HTMLFormElement;
	errors: Record<string, HTMLElement>;
}> {
	document.body.innerHTML = `
		<form>
			<base-field>
				<label>Email ${control}</label>
				<div id="errors">
					<base-field-error match="valueMissing">Required</base-field-error>
					<base-field-error match="typeMismatch">Not an email</base-field-error>
					<base-field-error match="taken">Taken</base-field-error>
					<base-field-error>Check this field</base-field-error>
				</div>
			</base-field>
			<button>Submit</button>
		</form>
	`;
	const field = document.querySelector<HTMLElement>("base-field");
	const input = document.querySelector("input");
	const form = document.querySelector("form");
	if (!field || !input || !form) throw new Error("not mounted");
	const errors = Object.fromEntries(
		[...document.querySelectorAll<HTMLElement>("base-field-error")].map(
			(error) => [error.getAttribute("match") ?? "", error],
		),
	);
	await customElements.whenDefined("base-field");
	await customElements.whenDefined("base-field-error");
	return { field, input, form, errors };
}

function shown(errors: Record<string, HTMLElement>): string[] {
	return Object.entries(errors)
		.filter(([, error]) => !error.hidden && error.matches(":state(shown)"))
		.map(([key]) => key);
}

it("touched after the control loses focus", async () => {
	const { field, input } = await mount(`<input>`);
	expect(field.matches(":state(touched)")).toBe(false);

	await userEvent.click(input);
	await userEvent.tab();

	expect(field.matches(":state(touched)")).toBe(true);
});

it("filled follows the value, including the initial one", async () => {
	const { field, input } = await mount(`<input value="draft">`);
	await expect.poll(() => field.matches(":state(filled)")).toBe(true);

	await userEvent.clear(input);

	expect(field.matches(":state(filled)")).toBe(false);
});

it("dirty while the value differs from the initial one", async () => {
	const { field, input } = await mount(`<input value="a">`);

	await userEvent.type(input, "b");
	expect(field.matches(":state(dirty)")).toBe(true);

	await userEvent.keyboard("{Backspace}");
	expect(field.matches(":state(dirty)")).toBe(false);
});

it("errors stay hidden before interaction", async () => {
	const { errors } = await mount(`<input type="email" required>`);

	expect(shown(errors)).toEqual([]);
});

it("only the error matching the validity shows after interaction", async () => {
	const { input, errors } = await mount(`<input type="email" required>`);

	await userEvent.type(input, "nope");
	await userEvent.tab();

	expect(shown(errors)).toEqual(["typeMismatch"]);
});

it("submitting shows errors on an untouched field", async () => {
	const { form, errors } = await mount(`<input type="email" required>`);

	form.requestSubmit();

	await expect.poll(() => shown(errors)).toEqual(["valueMissing"]);
});

it("aria-invalid follows user-invalid", async () => {
	const { input } = await mount(`<input type="email">`);

	await userEvent.type(input, "nope");
	await userEvent.tab();
	expect(input.getAttribute("aria-invalid")).toBe("true");

	await userEvent.clear(input);
	await userEvent.type(input, "a@b.c");
	expect(input.hasAttribute("aria-invalid")).toBe(false);
});

it("a custom validity message shows its error", async () => {
	const { input, errors } = await mount(`<input>`);
	input.addEventListener("input", () => {
		input.setCustomValidity(input.value === "admin" ? "taken" : "");
	});

	await userEvent.type(input, "admin");
	await userEvent.tab();

	expect(shown(errors)).toEqual(["taken"]);
});

it("a custom key clears as soon as the consumer's rule clears it", async () => {
	const { input, errors } = await mount(`<input>`);
	input.addEventListener("input", () => {
		input.setCustomValidity(input.value === "admin" ? "taken" : "");
	});

	await userEvent.type(input, "admin");
	await userEvent.tab();
	await userEvent.type(input, "s");

	expect(shown(errors)).toEqual([]);
});

it("the catch-all shows when no error with match is showing", async () => {
	const { input, errors } = await mount(`<input pattern="a+">`);

	await userEvent.type(input, "b");
	await userEvent.tab();

	expect(shown(errors)).toEqual([""]);
});

it("a custom message that is not a key falls to the catch-all", async () => {
	const { input, errors } = await mount(`<input>`);
	input.setCustomValidity("Some sentence");

	await userEvent.type(input, "a");
	await userEvent.tab();

	expect(shown(errors)).toEqual([""]);
});

it("the catch-all stays hidden while an error with match shows", async () => {
	const { input, errors } = await mount(`<input type="email">`);

	await userEvent.type(input, "nope");
	await userEvent.tab();

	expect(shown(errors)).toEqual(["typeMismatch"]);
});

it.runIf(server.browser === "chrome")(
	"the description reads only the shown error",
	async () => {
		const { input } = await mount(
			`<input type="email" required aria-describedby="errors">`,
		);
		expect(await commands.computedDescription("input")).toBe("");

		await userEvent.type(input, "nope");
		await userEvent.tab();

		expect(await commands.computedDescription("input")).toBe("Not an email");
	},
);
