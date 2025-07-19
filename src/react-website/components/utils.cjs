/**
 * Scrolls the window to the top of the page with a sequence of scrolls for smoother effect.
 * Uses setTimeout to scroll to top, then to the middle, then back to top, each after 800ms.
 * Does nothing if not running in a browser environment.
 */
export function scrollToTop() {
  if (typeof window !== 'undefined' && window.scrollTo) {
    // window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      window.scrollTo(0, 0);
      setTimeout(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
        setTimeout(() => {
          window.scrollTo(0, 0);
        }, 800);
      }, 800);
    }, 800);
  }
}
