import { expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "@/components/field/define";

async function mount(formAttributes = ""): Promise<{
	form: HTMLFormElement;
	first: HTMLInputElement;
	second: HTMLInputElement;
	submit: HTMLButtonElement;
	outside: HTMLButtonElement;
	submissions: () => number;
}> {
	document.body.innerHTML = `
		<button id="outside">Outside</button>
		<form ${formAttributes}>
			<base-field>
				<label>First <input id="first" pattern="a+" value="bbb"></label>
				<base-field-error>Check first</base-field-error>
			</base-field>
			<base-field>
				<label>Second <input id="second" required></label>
				<base-field-error id="second-error">Check second</base-field-error>
			</base-field>
			<button id="submit">Submit</button>
		</form>
	`;
	const form = document.querySelector("form");
	const first = document.querySelector<HTMLInputElement>("#first");
	const second = document.querySelector<HTMLInputElement>("#second");
	const submit = document.querySelector<HTMLButtonElement>("#submit");
	const outside = document.querySelector<HTMLButtonElement>("#outside");
	if (!form || !first || !second || !submit || !outside) {
		throw new Error("not mounted");
	}
	let count = 0;
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		count += 1;
	});
	await customElements.whenDefined("base-field");
	await customElements.whenDefined("base-field-error");
	return {
		form,
		first,
		second,
		submit,
		outside,
		submissions: () => count,
	};
}

it("a clicked submit focuses the first invalid control and selects it", async () => {
	const { first, submit, submissions } = await mount();

	await userEvent.click(submit);

	await expect.poll(() => document.activeElement).toBe(first);
	expect(first.selectionStart).toBe(0);
	expect(first.selectionEnd).toBe(3);
	expect(submissions()).toBe(0);
});

it("field cancels invalid so the browser shows no bubble", async () => {
	const { first, form } = await mount();
	let canceled = false;
	first.addEventListener("invalid", (event) => {
		canceled = event.defaultPrevented;
	});

	form.checkValidity();

	expect(canceled).toBe(true);
});

it("checkValidity shows the error until the control is valid", async () => {
	const { form, first } = await mount();
	const error = document.querySelector<HTMLElement>("base-field-error");

	form.checkValidity();
	expect(error?.hidden).toBe(false);

	first.value = "aaa";
	first.dispatchEvent(new Event("input", { bubbles: true }));
	expect(error?.hidden).toBe(true);
});

it("focus is not pulled back from outside the form", async () => {
	const { form, outside } = await mount();
	outside.focus();

	form.checkValidity();

	expect(document.activeElement).toBe(outside);
});

it("novalidate skips showing and focusing at submit", async () => {
	const { submit, submissions } = await mount("novalidate");
	const error = document.querySelector<HTMLElement>("#second-error");

	await userEvent.click(submit);

	await expect.poll(submissions).toBe(1);
	expect(error?.hidden).toBe(true);
	expect(document.activeElement).toBe(submit);
});

it("formnovalidate skips showing and focusing at submit", async () => {
	const { submit, submissions } = await mount();
	const error = document.querySelector<HTMLElement>("#second-error");
	submit.formNoValidate = true;

	await userEvent.click(submit);

	await expect.poll(submissions).toBe(1);
	expect(error?.hidden).toBe(true);
	expect(document.activeElement).toBe(submit);
});
