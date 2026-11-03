import { expect, it, vi } from "vite-plus/test";

import "@/components/toaster/define";

type ToastElement = HTMLElement & { dismiss: () => Promise<void> };

async function mount(
	attributes = `timeout="200"`,
	toasts = "",
): Promise<HTMLElement> {
	document.body.innerHTML = `<base-toaster ${attributes}>${toasts}</base-toaster>`;
	await customElements.whenDefined("base-toaster");
	await customElements.whenDefined("base-toast");
	const toaster = document.querySelector<HTMLElement>("base-toaster");
	if (!toaster) throw new Error("not mounted");
	return toaster;
}

function toast(text: string, extra = ""): HTMLElement {
	const element = document.createElement("base-toast");
	element.innerHTML = `<p>${text}</p>${extra}`;
	return element;
}

it("shows in the top layer while a toast is shown", async () => {
	const toaster = await mount();
	expect(toaster.matches(":popover-open")).toBe(false);

	toaster.append(toast("Saved"));

	await expect.poll(() => toaster.matches(":popover-open")).toBe(true);
});

it("hides a toast after the timeout and fires toggle, without removing it", async () => {
	const toaster = await mount();
	const saved = toast("Saved");
	const states: string[] = [];
	saved.addEventListener("toggle", (event) => {
		states.push(event.newState);
	});

	toaster.append(saved);

	await expect.poll(() => saved.hidden).toBe(true);
	await expect.poll(() => states).toEqual(["closed"]);
	expect(saved.isConnected).toBe(true);
	await expect.poll(() => toaster.matches(":popover-open")).toBe(false);
});

it("a toast with a button stays until dismissed", async () => {
	const toaster = await mount();
	const undo = toast("Deleted", `<button command="--close">Undo</button>`);
	toaster.append(undo);
	await new Promise((resolve) => {
		setTimeout(resolve, 400);
	});
	expect(undo.hidden).toBe(false);

	undo.querySelector("button")?.click();

	await expect.poll(() => undo.hidden).toBe(true);
});

it("dismiss() hides it", async () => {
	const toaster = await mount(`timeout="0"`);
	const saved = toast("Saved") as ToastElement;
	toaster.append(saved);
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});

	await saved.dismiss();

	expect(saved.hidden).toBe(true);
});

it("hover pauses the timer", async () => {
	const toaster = await mount();
	const saved = toast("Saved");
	toaster.append(saved);
	await new Promise((resolve) => {
		setTimeout(resolve, 20);
	});

	toaster.dispatchEvent(new PointerEvent("pointerenter"));
	await new Promise((resolve) => {
		setTimeout(resolve, 400);
	});
	expect(saved.hidden).toBe(false);

	toaster.dispatchEvent(new PointerEvent("pointerleave"));
	await expect.poll(() => saved.hidden).toBe(true);
});

it("toasts beyond the limit get limited, oldest first", async () => {
	const toaster = await mount(`timeout="0" limit="2"`);
	const toasts = ["A", "B", "C"].map((text) => toast(text));

	for (const each of toasts) toaster.append(each);

	await expect
		.poll(() => toasts.map((each) => each.matches(":state(limited)")))
		.toEqual([true, false, false]);
});

it("announces each toast with ariaNotify", async () => {
	const notify = vi.fn();
	Object.defineProperty(HTMLElement.prototype, "ariaNotify", {
		value: notify,
		configurable: true,
		writable: true,
	});
	const toaster = await mount(`timeout="0"`);

	toaster.append(toast("Saved"));

	await expect.poll(() => notify.mock.calls).toEqual([["Saved"]]);
});

it("show() adds a toast for plain script", async () => {
	const toaster = (await mount(`timeout="0"`)) as HTMLElement & {
		show: (toast: HTMLElement) => Promise<void>;
	};
	const saved = toast("Saved");

	await toaster.show(saved);

	expect(saved.parentElement).toBe(toaster);
});

it("swiping a toast's content out of view hides it", async () => {
	document.body.innerHTML = `
		<style>
			base-toast { display: flex; width: 200px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; }
			base-toast > * { flex: none; width: 200px; scroll-snap-align: start; }
		</style>
		<base-toaster timeout="0">
			<base-toast><p>Saved</p><div></div></base-toast>
		</base-toaster>
	`;
	await customElements.whenDefined("base-toast");
	const saved = document.querySelector<HTMLElement>("base-toast");
	if (!saved) throw new Error("not mounted");
	await new Promise((resolve) => {
		setTimeout(resolve, 50);
	});

	saved.scrollTo({ left: 200, behavior: "instant" });

	await expect.poll(() => saved.hidden).toBe(true);
});
