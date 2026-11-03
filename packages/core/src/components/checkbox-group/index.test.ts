import { expect, it, vi } from "vite-plus/test";

import "@/components/checkbox-group/define";

interface Mounted {
	parent: HTMLInputElement;
	children: HTMLInputElement[];
	form: HTMLFormElement;
}

async function mount(
	children = `
		<input type="checkbox" name="t" value="a">
		<input type="checkbox" name="t" value="b">
		<input type="checkbox" name="t" value="c">
	`,
): Promise<Mounted> {
	document.body.innerHTML = `
		<form>
			<input id="parent" type="checkbox" aria-controls="toppings">
			<base-checkbox-group id="toppings">${children}</base-checkbox-group>
		</form>
	`;
	await customElements.whenDefined("base-checkbox-group");
	const parent = document.querySelector<HTMLInputElement>("#parent");
	const form = document.querySelector("form");
	if (!parent || !form) throw new Error("not mounted");
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
	return {
		parent,
		children: [
			...document.querySelectorAll<HTMLInputElement>(
				"base-checkbox-group input",
			),
		],
		form,
	};
}

function states(children: HTMLInputElement[]): boolean[] {
	return children.map((child) => child.checked);
}

function at<T>(items: T[], index: number): T {
	const item = items[index];
	if (item === undefined) throw new Error("not mounted");
	return item;
}

it("the parent shows mixed, checked and unchecked from its children", async () => {
	const { parent, children } = await mount();
	expect([parent.checked, parent.indeterminate]).toEqual([false, false]);

	at(children, 0).click();
	expect([parent.checked, parent.indeterminate]).toEqual([false, true]);

	at(children, 1).click();
	at(children, 2).click();
	expect([parent.checked, parent.indeterminate]).toEqual([true, false]);
});

it("reads the initial state", async () => {
	const { parent } = await mount(`
		<input type="checkbox" checked>
		<input type="checkbox">
	`);

	expect(parent.indeterminate).toBe(true);
});

it("cycles checked, unchecked, then the hand-picked mix", async () => {
	const { parent, children } = await mount();
	at(children, 0).click();

	parent.click();
	expect(states(children)).toEqual([true, true, true]);

	parent.click();
	expect(states(children)).toEqual([false, false, false]);

	parent.click();
	expect(states(children)).toEqual([true, false, false]);
	expect(parent.indeterminate).toBe(true);

	parent.click();
	expect(states(children)).toEqual([true, true, true]);
});

it("toggles when there is no mix to restore", async () => {
	const { parent, children } = await mount();

	parent.click();
	expect(states(children)).toEqual([true, true, true]);

	parent.click();
	expect(states(children)).toEqual([false, false, false]);

	parent.click();
	expect(states(children)).toEqual([true, true, true]);
});

it("restores the mix from page load", async () => {
	const { parent, children } = await mount(`
		<input type="checkbox" checked>
		<input type="checkbox">
	`);

	parent.click();
	parent.click();
	parent.click();

	expect(states(children)).toEqual([true, false]);
});

it("leaves disabled children as they are", async () => {
	const { parent, children } = await mount(`
		<input type="checkbox">
		<input type="checkbox" disabled>
		<input type="checkbox" disabled checked>
	`);

	parent.click();
	expect(states(children)).toEqual([true, false, true]);

	parent.click();
	expect(states(children)).toEqual([false, false, true]);
});

it("children it changes fire input and change", async () => {
	const { parent, children } = await mount();
	const events: string[] = [];
	for (const type of ["input", "change"]) {
		at(children, 1).addEventListener(type, () => {
			events.push(type);
		});
	}

	parent.click();

	expect(events).toEqual(["input", "change"]);
});

it("follows reset", async () => {
	const { parent, children, form } = await mount();
	at(children, 0).click();
	expect(parent.indeterminate).toBe(true);

	form.reset();

	await expect.poll(() => parent.indeterminate).toBe(false);
});

it("follows a child added later", async () => {
	const { parent, children } = await mount(`<input type="checkbox">`);
	at(children, 0).click();
	expect(parent.checked).toBe(true);

	document
		.querySelector("base-checkbox-group")
		?.append(
			Object.assign(document.createElement("input"), { type: "checkbox" }),
		);

	await expect.poll(() => parent.indeterminate).toBe(true);
});

it("warns without an id", async () => {
	const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
	document.body.innerHTML = `<base-checkbox-group></base-checkbox-group>`;
	await customElements.whenDefined("base-checkbox-group");
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});

	expect(warnSpy.mock.calls.flat().join(" ")).toContain("needs an id");
	warnSpy.mockRestore();
});
