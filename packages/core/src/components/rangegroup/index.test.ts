import { expect, it } from "vite-plus/test";
import { commands, server, userEvent } from "vite-plus/test/browser";

import "@/components/rangegroup/define";

const STACKED = `
	<style>
		base-rangegroup { display: block; position: relative; width: 200px; height: 20px; }
		base-rangegroup input { position: absolute; inset: 0; margin: 0; width: 100%; pointer-events: none; }
		base-rangegroup input::-webkit-slider-thumb { pointer-events: auto; }
		base-rangegroup input::-moz-range-thumb { pointer-events: auto; }
	</style>
`;

interface Mounted {
	group: HTMLBaseRangegroupElement;
	first: HTMLInputElement;
	second: HTMLInputElement;
}

async function mount(
	attributes = `stepbetween="5"`,
	children = `
		<input type="range" name="low" value="20">
		<input type="range" name="high" value="80">
	`,
): Promise<Mounted> {
	document.body.innerHTML = `${STACKED}<form><base-rangegroup ${attributes}>${children}</base-rangegroup></form>`;
	await customElements.whenDefined("base-rangegroup");
	const group = document.querySelector("base-rangegroup");
	const [first, second] = document.querySelectorAll("input");
	if (!group || !first || !second) throw new Error("not mounted");
	await expect.poll(() => first.getAttribute("max")).not.toBeNull();
	return { group, first, second };
}

it("passes min and max to inputs that omit them", async () => {
	const { first, second } = await mount(
		`min="10" max="50"`,
		`<input type="range" value="20"><input type="range" max="40" value="30">`,
	);

	expect(first.min).toBe("10");
	expect(first.max).toBe("50");
	expect(second.max).toBe("40");
});

it("follows a changed min and max", async () => {
	const { group, first } = await mount();

	group.max = 200;

	await expect.poll(() => first.max).toBe("200");
});

it("exposes the proposal's API", async () => {
	const { group, first, second } = await mount();

	expect(group.values).toEqual([20, 80]);
	expect(group.inputs).toEqual([first, second]);
	expect(await group.getRangeInput(1)).toBe(second);

	await group.setRangeValue(0, 30);
	expect(first.valueAsNumber).toBe(30);
});

it("setRangeValue stops at the neighbor plus stepbetween", async () => {
	const { group, first } = await mount();

	await group.setRangeValue(0, 95);

	expect(first.valueAsNumber).toBe(75);
});

it("a thumb can reach its neighbor without stepbetween, not pass it", async () => {
	const { group, first } = await mount("");

	await group.setRangeValue(0, 95);

	expect(first.valueAsNumber).toBe(80);
});

it("keeps stepbetween when the input's step would round past it", async () => {
	const { group, first } = await mount(
		`stepbetween="3"`,
		`<input type="range" step="10" value="20"><input type="range" value="50">`,
	);

	await group.setRangeValue(0, 49);

	expect(first.valueAsNumber).toBe(40);
});

it("a keyboard move stops at the neighbor before the consumer's listener", async () => {
	const { first, second } = await mount(
		`stepbetween="5"`,
		`<input type="range" name="low" value="20"><input type="range" name="high" value="25">`,
	);
	const seen: number[] = [];
	second.addEventListener("input", () => {
		seen.push(second.valueAsNumber);
	});
	second.focus();

	await userEvent.keyboard("{ArrowLeft}");

	expect(second.valueAsNumber).toBe(25);
	expect(seen).toEqual([25]);
	expect(first.valueAsNumber).toBe(20);
});

it("a track press moves the nearest thumb and focuses it", async () => {
	const { group, first, second } = await mount(
		`stepbetween="5"`,
		`<input type="range" value="10"><input type="range" value="40">`,
	);
	const events: string[] = [];
	for (const type of ["input", "change"]) {
		second.addEventListener(type, () => {
			events.push(type);
		});
	}

	await userEvent.click(group);

	await expect.poll(() => second.valueAsNumber).toBe(50);
	expect(first.valueAsNumber).toBe(10);
	expect(document.activeElement).toBe(second);
	await expect.poll(() => events.at(-1)).toBe("change");
});

it("a press skips a disabled thumb", async () => {
	const { group, first, second } = await mount(
		"",
		`<input type="range" value="10"><input type="range" value="40" disabled>`,
	);

	await userEvent.click(group);

	await expect.poll(() => first.valueAsNumber).toBe(40);
	expect(second.valueAsNumber).toBe(40);
});

it("disabled disables every thumb and gives back only what it took", async () => {
	const { group, first, second } = await mount(
		"",
		`<input type="range" value="10"><input type="range" value="40" disabled>`,
	);

	group.disabled = true;
	await expect.poll(() => first.disabled).toBe(true);

	group.disabled = false;
	await expect.poll(() => first.disabled).toBe(false);
	expect(second.disabled).toBe(true);
});

it("sets position variables and follows reset", async () => {
	const { group, first } = await mount();
	const position = (): string =>
		group.style.getPropertyValue("--base-rangegroup-thumb-1");
	expect(position()).toBe("20%");

	await group.setRangeValue(0, 40);
	expect(position()).toBe("40%");

	first.form?.reset();
	await expect.poll(position).toBe("20%");
});

it("thumbs submit their own values and the group adds nothing", async () => {
	const { first } = await mount();
	if (!first.form) throw new Error("not mounted");

	expect([...new FormData(first.form).entries()]).toEqual([
		["low", "20"],
		["high", "80"],
	]);
});

it.runIf(server.browser === "chrome")("exposes a group role", async () => {
	await mount(`aria-label="Price"`);

	expect(await commands.computedProperty("base-rangegroup", "role")).toBe(
		"group",
	);
});
