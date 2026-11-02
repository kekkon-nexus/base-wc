import { expect, it } from "vite-plus/test";
import { commands, server, userEvent } from "vite-plus/test/browser";

import "@/components/field/define";

async function mount(): Promise<{
	field: HTMLElement;
	input: HTMLInputElement;
	description: HTMLElement;
	errors: HTMLElement;
}> {
	document.body.innerHTML = `
		<base-field>
			<label>Email <input type="email" required></label>
			<base-field-errors>
				<base-field-error match="typeMismatch">Not an email</base-field-error>
			</base-field-errors>
			<base-field-description>We never share it.</base-field-description>
		</base-field>
	`;
	const field = document.querySelector<HTMLElement>("base-field");
	const input = document.querySelector("input");
	const description = document.querySelector<HTMLElement>(
		"base-field-description",
	);
	const errors = document.querySelector<HTMLElement>("base-field-errors");
	if (!field || !input || !description || !errors) {
		throw new Error("not mounted");
	}
	await customElements.whenDefined("base-field");
	await customElements.whenDefined("base-field-errors");
	await expect.poll(() => input.ariaDescribedByElements?.length).toBe(2);
	return { field, input, description, errors };
}

it("links the description then the errors, whatever the markup order", async () => {
	const { input, description, errors } = await mount();

	expect(input.ariaDescribedByElements?.[0]).toBe(description);
	expect(input.ariaDescribedByElements?.[1]).toBe(errors);
});

it("links a control a framework swaps in", async () => {
	const { input, description, errors } = await mount();
	const replacement = document.createElement("input");

	input.replaceWith(replacement);

	await expect.poll(() => replacement.ariaDescribedByElements?.length).toBe(2);
	expect(replacement.ariaDescribedByElements?.[0]).toBe(description);
	expect(replacement.ariaDescribedByElements?.[1]).toBe(errors);
});

it("aria-invalid follows an error shown from checkValidity", async () => {
	const { input } = await mount();

	input.checkValidity();
	expect(input.ariaInvalid).toBe("true");

	input.value = "a@b.c";
	input.dispatchEvent(new Event("input", { bubbles: true }));
	expect(input.hasAttribute("aria-invalid")).toBe(false);
});

it.runIf(server.browser === "chrome")(
	"the description reads the shown error through the link",
	async () => {
		const { input } = await mount();
		expect(await commands.computedDescription("input")).toBe(
			"We never share it.",
		);

		await userEvent.type(input, "nope");
		await userEvent.tab();

		expect(await commands.computedDescription("input")).toBe(
			"We never share it. Not an email",
		);
	},
);

it.runIf(server.browser === "chrome")(
	"the errors element is a polite live region with no attribute",
	async () => {
		const { errors, input } = await mount();
		await userEvent.type(input, "nope");
		await userEvent.tab();

		expect(errors.hasAttribute("aria-live")).toBe(false);
		expect(await commands.computedProperty("base-field-errors", "live")).toBe(
			"polite",
		);
	},
);
