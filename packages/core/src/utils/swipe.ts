/** Content counts as gone once at most this many square pixels of it remain in view. */
const GONE = 1;

/**
 * @param container a scroll-snap container
 * @returns its children with content; the empty ones are spacers and snap markers
 */
export function content(container: Element): Element[] {
	return [...container.children].filter((child) => child.hasChildNodes());
}

function visible(element: Element, area: DOMRect): number {
	const rect = element.getBoundingClientRect();
	const width =
		Math.min(rect.right, area.right) - Math.max(rect.left, area.left);
	const height =
		Math.min(rect.bottom, area.bottom) - Math.max(rect.top, area.top);
	return Math.max(width, 0) * Math.max(height, 0);
}

/**
 * Swiped away means the content scrolled out of view, so no direction or spacer has to be known.
 *
 * @param container a scroll-snap container
 * @returns whether its content is out of view
 */
export function swipedAway(container: Element): boolean {
	const area = container.getBoundingClientRect();
	const parts = content(container);
	return parts.length > 0 && parts.every((part) => visible(part, area) <= GONE);
}

/**
 * Scrolls so the content is in view, where its snap position takes over.
 *
 * @param container a scroll-snap container
 * @param behavior instant on open, smooth when snapping back
 */
export function reveal(container: Element, behavior: ScrollBehavior): void {
	const [first] = content(container);
	if (!first) return;
	const area = container.getBoundingClientRect();
	const rect = first.getBoundingClientRect();
	container.scrollBy({
		left: rect.left - area.left,
		top: rect.top - area.top,
		behavior,
	});
}
