import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "@/components/field/define";
import "@/components/otp-field/define";

const NUMERIC = `name="code" inputmode="numeric" pattern="[0-9]{6}"`;

async function mount(
	attributes = `length="6"`,
	input = NUMERIC,
): Promise<{
	otp: HTMLBaseOtpFieldElement;
	input: HTMLInputElement;
	submissions: () => number;
}> {
	document.body.innerHTML = `
		<form><base-otp-field ${attributes}><input ${input}></base-otp-field></form>
	`;
	await customElements.whenDefined("base-otp-field");
	const otp = document.querySelector("base-otp-field");
	const element = document.querySelector("input");
	const form = document.querySelector("form");
	if (!otp || !element || !form) throw new Error("not mounted");
	let count = 0;
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		count += 1;
	});
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
	return { otp, input: element, submissions: () => count };
}

function paste(input: HTMLInputElement, text: string): void {
	input.value = text;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function settle(): Promise<void> {
	await new Promise((resolve) => {
		setTimeout(resolve, 30);
	});
}

it("keeps a pasted code with spaces and separators whole", async () => {
	const { input } = await mount();

	paste(input, "123 456");
	expect(input.value).toBe("123456");
	expect(input.validity.valid).toBe(true);

	paste(input, " 123-456\n");
	expect(input.value).toBe("123456");
});

it("drops typed characters that are not allowed", async () => {
	const { input } = await mount();

	await userEvent.type(input, "1a2 3");

	expect(input.value).toBe("123");
});

it("clamps to the length", async () => {
	const { input } = await mount();

	paste(input, "12345678");

	expect(input.value).toBe("123456");
});

it("keeps letters without numeric inputmode", async () => {
	const { input } = await mount(`length="4"`, `name="code"`);

	paste(input, "ab-12");

	expect(input.value).toBe("ab12");
});

it("normalize runs before filtering", async () => {
	const { otp, input } = await mount(`length="4"`, `name="code"`);
	otp.normalize = (value) => value.toUpperCase();

	paste(input, "ab-cd");

	expect(input.value).toBe("ABCD");
});

it("listeners on the input only see the clean value", async () => {
	const { input } = await mount();
	const seen: string[] = [];
	input.addEventListener("input", () => {
		seen.push(input.value);
	});

	paste(input, "12 34");

	expect(seen).toEqual(["1234"]);
});

it("the caret stays with the kept characters", async () => {
	const { input } = await mount();
	input.value = "1234";
	input.focus();
	input.setSelectionRange(2, 2);

	await userEvent.keyboard("x");

	expect(input.value).toBe("1234");
	expect(input.selectionStart).toBe(2);
});

it("autosubmit submits once when full and valid", async () => {
	const { input, submissions } = await mount(`length="6" autosubmit`);

	paste(input, "12345");
	await settle();
	expect(submissions()).toBe(0);

	paste(input, "123456");
	await expect.poll(submissions).toBe(1);

	paste(input, "123456");
	await settle();
	expect(submissions()).toBe(1);
});

it("autosubmit submits a corrected code after it became partial", async () => {
	const { input, submissions } = await mount(`length="6" autosubmit`);
	paste(input, "123456");
	await expect.poll(submissions).toBe(1);

	paste(input, "12345");
	await settle();
	paste(input, "123456");

	await expect.poll(submissions).toBe(2);
});

it("autosubmit leaves an invalid full code alone", async () => {
	const { input, submissions } = await mount(
		`length="6" autosubmit`,
		`name="code" pattern="9[0-9]{5}" inputmode="numeric"`,
	);

	paste(input, "123456");
	await settle();

	expect(submissions()).toBe(0);
});

it("does nothing without autosubmit", async () => {
	const { input, submissions } = await mount();

	paste(input, "123456");
	await settle();

	expect(submissions()).toBe(0);
});

it("autosubmit waits for a field's validate", async () => {
	document.body.innerHTML = `
		<form>
			<base-field>
				<base-otp-field length="6" autosubmit>
					<input name="code" inputmode="numeric" pattern="[0-9]{6}">
				</base-otp-field>
			</base-field>
		</form>
	`;
	await customElements.whenDefined("base-otp-field");
	await customElements.whenDefined("base-field");
	const field = document.querySelector("base-field");
	const input = document.querySelector("input");
	const form = document.querySelector("form");
	if (!field || !input || !form) throw new Error("not mounted");
	await settle();
	let count = 0;
	form.addEventListener("submit", (event) => {
		event.preventDefault();
		count += 1;
	});
	let finish: (key?: string) => void = () => undefined;
	field.validate = () =>
		new Promise((resolve) => {
			finish = resolve;
		});
	input.focus();

	paste(input, "123456");
	await settle();
	expect(count).toBe(0);

	finish();
	await expect.poll(() => count).toBe(1);
});

it("warns about maxlength on the input", async () => {
	const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

	await mount(`length="6"`, `maxlength="6"`);

	expect(warnSpy.mock.calls.flat().join(" ")).toContain("maxlength");
	warnSpy.mockRestore();
});
