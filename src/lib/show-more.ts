interface ShowMoreOptions {
  showMoreId: string;
  showLessId: string;
  hiddenClass: string;
  containerId: string;
  initialVisibleCount: number;
}

export function setupShowMoreToggle({
  showMoreId,
  showLessId,
  hiddenClass,
  containerId,
  initialVisibleCount,
}: ShowMoreOptions): void {
  const showMore = document.getElementById(showMoreId) as HTMLButtonElement | null;
  const showLess = document.getElementById(showLessId) as HTMLButtonElement | null;
  const container = document.getElementById(containerId);

  if (!showMore || !showLess || !container) return;

  const items = Array.from(container.children) as HTMLElement[];
  items.forEach((item, index) => {
    item.classList.toggle(hiddenClass, index >= initialVisibleCount);
  });

  showMore.addEventListener("click", () => {
    container.querySelectorAll<HTMLElement>(`.${hiddenClass}`).forEach((item) => {
      item.classList.remove(hiddenClass);
    });
    showMore.hidden = true;
    showLess.hidden = false;
  });

  showLess.addEventListener("click", () => {
    items.forEach((item, index) => {
      item.classList.toggle(hiddenClass, index >= initialVisibleCount);
    });
    showLess.hidden = true;
    showMore.hidden = false;
    container.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}
