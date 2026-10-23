/** The row over a month's first week that carries its short name (MonthView's floating header). */
export const MONTH_LABEL_PX = 28;

/**
 * Where to scroll a month view's scroller (`box`) to bring the month `el` to
 * the top. With a floating header the month's first week goes just under the
 * header, its short name tucked behind it as in Apple Calendar; otherwise the
 * month's own top.
 */
export function monthScrollTop(box: HTMLElement, el: HTMLElement): number {
  if (!("floatingHeader" in box.dataset)) return el.offsetTop;
  return el.offsetTop + MONTH_LABEL_PX - (parseFloat(box.style.scrollPaddingTop) || 0);
}
