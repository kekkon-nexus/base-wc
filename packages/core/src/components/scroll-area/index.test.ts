import { expect, it } from "vite-plus/test";

import "@/components/scroll-area/define";

async function mount(style = ""): Promise<HTMLElement> {
	document.body.innerHTML = `
		<base-scroll-area style="display: block; overflow: auto; width: 100px; height: 100px; ${style}">
			<div id="content" style="width: 300px; height: 300px"></div>
		</base-scroll-area>
	`;
	await customElements.whenDefined("base-scroll-area");
	const area = document.querySelector<HTMLElement>("base-scroll-area");
	if (!area) throw new Error("not mounted");
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
	return area;
}

const STATES = [
	"scrollable-block-start",
	"scrollable-block-end",
	"scrollable-inline-start",
	"scrollable-inline-end",
];

function states(area: HTMLElement): string[] {
	return STATES.filter((state) => area.matches(`:state(${state})`));
}

/**
 * @param area the scroll area
 * @returns the furthest scroll position, which the scrollbars' own size moves out
 */
function max(area: HTMLElement): [number, number] {
	return [
		area.scrollWidth - area.clientWidth,
		area.scrollHeight - area.clientHeight,
	];
}

async function scrollTo(
	area: HTMLElement,
	left: number,
	top: number,
): Promise<void> {
	area.scrollTo({ left, top, behavior: "instant" });
	await expect
		.poll(() => [area.scrollLeft, area.scrollTop])
		.toEqual([left, top]);
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});
}

it("at the start only the ends are scrollable", async () => {
	const area = await mount();

	expect(states(area)).toEqual([
		"scrollable-block-end",
		"scrollable-inline-end",
	]);
});

it("in the middle every edge is scrollable", async () => {
	const area = await mount();

	await scrollTo(area, 100, 100);

	expect(states(area)).toEqual(STATES);
});

it("at the end only the starts are scrollable", async () => {
	const area = await mount();

	await scrollTo(area, ...max(area));

	expect(states(area)).toEqual([
		"scrollable-block-start",
		"scrollable-inline-start",
	]);
});

it("right to left counts the inline start from the right", async () => {
	const area = await mount("direction: rtl");
	expect(states(area)).toEqual([
		"scrollable-block-end",
		"scrollable-inline-end",
	]);

	await scrollTo(area, -max(area)[0], 0);

	expect(states(area)).toEqual([
		"scrollable-block-end",
		"scrollable-inline-start",
	]);
});

it("vertical-rl puts the block start on the right", async () => {
	const area = await mount("writing-mode: vertical-rl");

	expect(states(area)).toEqual([
		"scrollable-block-end",
		"scrollable-inline-end",
	]);
});

it("follows content that grows without a scroll", async () => {
	const area = await mount();
	const content = document.querySelector<HTMLElement>("#content");
	if (!content) throw new Error("not mounted");

	content.style.width = "50px";
	content.style.height = "50px";

	await expect.poll(() => states(area)).toEqual([]);

	content.style.height = "300px";
	await expect.poll(() => states(area)).toEqual(["scrollable-block-end"]);
});

it("follows a child added later", async () => {
	document.body.innerHTML = `
		<base-scroll-area style="display: block; overflow: auto; width: 100px; height: 100px"></base-scroll-area>
	`;
	await customElements.whenDefined("base-scroll-area");
	const area = document.querySelector<HTMLElement>("base-scroll-area");
	if (!area) throw new Error("not mounted");
	expect(states(area)).toEqual([]);

	const child = document.createElement("div");
	child.style.height = "300px";
	area.append(child);

	await expect.poll(() => states(area)).toEqual(["scrollable-block-end"]);
});

it("scrolling is set while scrolling and cleared on scrollend", async () => {
	const area = await mount();
	const seen: boolean[] = [];
	area.addEventListener("scroll", () => {
		seen.push(area.matches(":state(scrolling)"));
	});

	await scrollTo(area, 0, 50);

	expect(seen).toContain(true);
	await expect.poll(() => area.matches(":state(scrolling)")).toBe(false);
});
