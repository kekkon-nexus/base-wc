import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

import "@/components/field/define";

const warnSpy = vi.spyOn(console, "warn");

beforeEach(() => {
	warnSpy.mockClear();
	warnSpy.mockImplementation(() => undefined);
});

afterEach(() => {
	document.body.innerHTML = "";
});

function warnings(): string[] {
	return warnSpy.mock.calls.map(([message]) => String(message));
}

async function mount(html: string): Promise<HTMLInputElement> {
	document.body.innerHTML = html;
	await customElements.whenDefined("base-field");
	const input = document.querySelector("input");
	if (!input) throw new Error("not mounted");
	return input;
}

it("warns about a constraint with no error and no catch-all", async () => {
	await mount(`<base-field><input maxlength="3"></base-field>`);

	await expect
		.poll(warnings)
		.toEqual([`[base-wc] <input> can fail "tooLong", which has no error.`]);
});

it("does not warn while a catch-all exists", async () => {
	await mount(
		`<base-field><input pattern="a"><base-field-error></base-field-error></base-field>`,
	);
	await new Promise((resolve) => {
		setTimeout(resolve, 50);
	});

	expect(warnings()).toEqual([]);
});

it("range never warns about a step", async () => {
	await mount(`<base-field><input type="range" step="5"></base-field>`);
	await new Promise((resolve) => {
		setTimeout(resolve, 50);
	});

	expect(warnings()).toEqual([]);
});

it("warns about a reserved key used as a custom key", async () => {
	const input = await mount(
		`<base-field><input><base-field-error></base-field-error></base-field>`,
	);

	input.setCustomValidity("tooShort");
	input.dispatchEvent(new Event("input", { bubbles: true }));

	expect(warnings()).toEqual([
		`[base-wc] "tooShort" is reserved and can't be a custom key.`,
	]);
});

it("warns about match values that can never show", async () => {
	await mount(
		`<base-field><input><base-field-error match="valid"></base-field-error></base-field>`,
	);

	await expect
		.poll(warnings)
		.toEqual([
			`[base-wc] match="valid" never shows: use a custom key or a catch-all.`,
		]);
});
