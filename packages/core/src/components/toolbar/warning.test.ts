import { expect, it, vi } from "vite-plus/test";

import "@/components/toolbar/define";

// Its own file: once loaded, the polyfill keeps polyfilling new focusgroups across the page.
it.runIf(!("focusGroup" in HTMLElement.prototype))(
	"warns without focusgroup or its polyfill",
	async () => {
		const warnSpy = vi
			.spyOn(console, "warn")
			.mockImplementation(() => undefined);
		document.body.innerHTML = `<base-toolbar><button>A</button><button>B</button></base-toolbar>`;
		await customElements.whenDefined("base-toolbar");

		await expect
			.poll(() => warnSpy.mock.calls.flat().join(" "))
			.toContain("focusgroup-polyfill");
		warnSpy.mockRestore();
	},
);
