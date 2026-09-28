// Shared motion tokens (kept out of component files so React fast refresh
// can hot-swap the components that use them).

export const EASE = [0.22, 1, 0.36, 1];

/** Staggered list container + item variants. */
export const staggerParent = (stagger = 0.06, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: stagger, delayChildren: delay } },
});

export const staggerChild = {
  hidden: { opacity: 0, y: 14, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: EASE } },
};
