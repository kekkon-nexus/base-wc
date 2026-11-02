import { expect, it } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "@/components/field/define";
import "@/components/number-field/define";

interface Mounted {
	input: HTMLInputElement;
	down: HTMLButtonElement;
	up: HTMLButtonElement;
}

async function mount(
	attributes = `min="0" max="10" value="5"`,
): Promise<Mounted> {
	document.body.innerHTML = `
		<form>
			<base-number-field>
				<button id="down" type="button" command="--step-down" commandfor="qty" tabindex="-1">-</button>
				<input id="qty" name="qty" type="number" ${attributes}>
				<button id="up" type="button" command="--step-up" commandfor="qty" tabindex="-1">+</button>
			</base-number-field>
		</form>
	`;
	await customElements.whenDefined("base-number-field");
	const input = document.querySelector("input");
	const down = document.querySelector<HTMLButtonElement>("#down");
	const up = document.querySelector<HTMLButtonElement>("#up");
	if (!input || !down || !up) throw new Error("not mounted");
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
	return { input, down, up };
}

function record(input: HTMLInputElement): string[] {
	const events: string[] = [];
	for (const type of ["input", "change"]) {
		input.addEventListener(type, () => {
			events.push(type);
		});
	}
	return events;
}

it("a click steps once and fires input and change", async () => {
	const { input, up } = await mount();
	const events = record(input);

	await userEvent.click(up);

	await expect.poll(() => input.value).toBe("6");
	expect(events).toEqual(["input", "change"]);
});

it("steps down and focuses the input after a mouse press", async () => {
	const { input, down } = await mount();

	await userEvent.click(down);

	await expect.poll(() => input.value).toBe("4");
	expect(document.activeElement).toBe(input);
});

it("follows the input's step", async () => {
	const { input, up } = await mount(`min="0" step="5" value="5"`);

	await userEvent.click(up);

	await expect.poll(() => input.value).toBe("10");
});

it('step="any" steps by one within the limits', async () => {
	const { input, up } = await mount(`step="any" max="2" value="1.5"`);

	await userEvent.click(up);

	await expect.poll(() => input.value).toBe("2");
});

it("an empty input steps from zero", async () => {
	const { input, up } = await mount(`min="0"`);

	await userEvent.click(up);

	await expect.poll(() => input.value).toBe("1");
});

it("disables a button at its limit and enables it after", async () => {
	const { input, up, down } = await mount(`min="0" max="6" value="5"`);

	await userEvent.click(up);

	await expect.poll(() => up.disabled).toBe(true);
	expect(down.disabled).toBe(false);
	expect(input.value).toBe("6");

	await userEvent.click(down);
	await expect.poll(() => up.disabled).toBe(false);
});

it("keeps a button the consumer disabled", async () => {
	const { input, up } = await mount();
	up.disabled = true;

	input.value = "10";
	input.dispatchEvent(new Event("input", { bubbles: true }));
	input.value = "5";
	input.dispatchEvent(new Event("input", { bubbles: true }));

	expect(up.disabled).toBe(true);
});

it("disables both buttons while the input is read-only", async () => {
	const { input, up, down } = await mount();

	input.readOnly = true;

	await expect.poll(() => up.disabled).toBe(true);
	expect(down.disabled).toBe(true);

	input.readOnly = false;
	await expect.poll(() => up.disabled).toBe(false);
});

it("follows reset", async () => {
	const { input, up } = await mount(`min="0" max="6" value="5"`);
	await userEvent.click(up);
	await expect.poll(() => up.disabled).toBe(true);

	input.form?.reset();

	await expect.poll(() => up.disabled).toBe(false);
});

it("a hold repeats, fires change once and does not step on release", async () => {
	const { input, up } = await mount(`min="0" max="100" value="0"`);
	const events = record(input);
	const options = { bubbles: true, button: 0, pointerType: "mouse" };

	up.dispatchEvent(new PointerEvent("pointerdown", options));
	await expect.poll(() => input.valueAsNumber).toBeGreaterThan(2);
	document.dispatchEvent(new PointerEvent("pointerup", options));
	const released = input.valueAsNumber;

	up.click();
	await new Promise((resolve) => {
		setTimeout(resolve, 120);
	});

	expect(input.valueAsNumber).toBe(released);
	expect(events.filter((type) => type === "change")).toHaveLength(1);
});

it("a hold stops at the limit", async () => {
	const { input, up } = await mount(`min="0" max="2" value="0"`);
	const options = { bubbles: true, button: 0, pointerType: "mouse" };

	up.dispatchEvent(new PointerEvent("pointerdown", options));
	await expect.poll(() => input.value).toBe("2");
	await expect.poll(() => up.disabled).toBe(true);
	document.dispatchEvent(new PointerEvent("pointerup", options));

	expect(input.value).toBe("2");
});

it("works inside a field", async () => {
	document.body.innerHTML = `
		<base-field>
			<base-number-field>
				<input id="qty" type="number" max="1" value="1">
				<button type="button" command="--step-down" commandfor="qty">-</button>
			</base-number-field>
		</base-field>
	`;
	await customElements.whenDefined("base-number-field");
	await customElements.whenDefined("base-field");
	const field = document.querySelector("base-field");
	const button = document.querySelector("button");
	if (!field || !button) throw new Error("not mounted");
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});

	await userEvent.click(button);

	await expect.poll(() => field.matches(":state(dirty)")).toBe(true);
});
