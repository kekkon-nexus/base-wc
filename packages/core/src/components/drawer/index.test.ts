import { expect, it } from "vite-plus/test";

import "@/components/drawer/define";

const STYLE = `
	<style>
		dialog { padding: 0; border: 0; width: 300px; max-height: none; height: 200px; }
		base-drawer {
			display: block; height: 100%; overflow-y: auto;
			scroll-snap-type: y mandatory; scrollbar-width: none;
		}
		.spacer { height: 200px; scroll-snap-align: start; }
		.sheet { height: 150px; scroll-snap-align: end; }
	</style>
`;

async function mount(): Promise<{
	dialog: HTMLDialogElement;
	drawer: HTMLElement;
}> {
	document.body.innerHTML = `${STYLE}
		<dialog>
			<base-drawer>
				<div class="spacer"></div>
				<div class="sheet"><button>Close</button> Sheet</div>
			</base-drawer>
		</dialog>
	`;
	await customElements.whenDefined("base-drawer");
	const dialog = document.querySelector("dialog");
	const drawer = document.querySelector<HTMLElement>("base-drawer");
	if (!dialog || !drawer) throw new Error("not mounted");
	return { dialog, drawer };
}

async function settle(): Promise<void> {
	await new Promise((resolve) => {
		setTimeout(resolve, 100);
	});
}

it("opens scrolled to the sheet", async () => {
	const { dialog, drawer } = await mount();

	dialog.showModal();

	await expect.poll(() => drawer.scrollTop).toBeGreaterThan(100);
});

it("swiping the sheet out of view closes the dialog", async () => {
	const { dialog, drawer } = await mount();
	dialog.showModal();
	await expect.poll(() => drawer.scrollTop).toBeGreaterThan(100);

	drawer.scrollTo({ top: 0, behavior: "instant" });

	await expect.poll(() => dialog.open).toBe(false);
});

it("a canceled close snaps the sheet back", async () => {
	const { dialog, drawer } = await mount();
	dialog.addEventListener("cancel", (event) => {
		event.preventDefault();
	});
	dialog.showModal();
	await expect.poll(() => drawer.scrollTop).toBeGreaterThan(100);

	drawer.scrollTo({ top: 0, behavior: "instant" });
	await settle();

	expect(dialog.open).toBe(true);
	await expect.poll(() => drawer.scrollTop).toBeGreaterThan(100);
});

it("a scroll that leaves the sheet in view keeps it open", async () => {
	const { dialog, drawer } = await mount();
	dialog.showModal();
	await expect.poll(() => drawer.scrollTop).toBeGreaterThan(100);

	drawer.scrollTo({ top: 100, behavior: "instant" });
	await settle();

	expect(dialog.open).toBe(true);
});

it("reopens scrolled to the sheet", async () => {
	const { dialog, drawer } = await mount();
	dialog.showModal();
	await expect.poll(() => drawer.scrollTop).toBeGreaterThan(100);
	drawer.scrollTo({ top: 0, behavior: "instant" });
	await expect.poll(() => dialog.open).toBe(false);

	dialog.showModal();

	await expect.poll(() => drawer.scrollTop).toBeGreaterThan(100);
});
