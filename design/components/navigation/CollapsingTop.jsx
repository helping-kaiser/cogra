import React from "react";

/* The screen's collapsing top: the header (and the key banner when present) leaves
   with the flow scrolling down — but only once HALF the region's own slot is
   scrolled past; the exit transition and the scroll itself cover the rest of the
   slot — and returns only after about a THIRD OF A SCREEN of accumulated upward
   scroll, so a short correction toward a post's top summons nothing. Any downward
   scroll resets the tally, and the region always pins back once its own slot
   returns to view — a hidden sticky region with its slot on-screen would leave a
   hole.

   The sentinel marks the region's natural position; a sticky element cannot
   measure that itself once stuck. `scrollHost` lets a scroll container other than
   the window drive it (the UI kit's phone frame does this). */

export function CollapsingTop({ children, scrollHost }) {
  const sentinel = React.useRef(null);
  const region = React.useRef(null);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    const host = scrollHost?.current ?? window;
    const readY = () => (host === window ? window.scrollY : host.scrollTop);
    const viewport = () => (host === window ? window.innerHeight : host.clientHeight);
    let lastY = readY();
    let upRun = 0;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = readY();
        const delta = y - lastY;
        if (Math.abs(delta) > 4) {
          const height = region.current?.offsetHeight ?? 0;
          const hostTop = host === window ? 0 : host.getBoundingClientRect().top;
          const slotTop = (sentinel.current?.getBoundingClientRect().top ?? 0) - hostTop;
          if (delta > 0) {
            upRun = 0;
            if (slotTop < -height / 2) setHidden(true);
          } else {
            upRun -= delta;
            if (upRun >= viewport() / 3 || slotTop >= -height / 2) setHidden(false);
          }
          lastY = y;
        }
        ticking = false;
      });
    };
    host.addEventListener("scroll", onScroll, { passive: true });
    return () => host.removeEventListener("scroll", onScroll);
  }, [scrollHost]);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" />
      <div
        ref={region}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          gap: "var(--stack-gap)",
          background: "var(--surface)",
          paddingBottom: "var(--space-2)",
          transform: hidden ? "translateY(-110%)" : "translateY(0)",
          transition: "transform var(--duration-collapsing-top) var(--ease-standard)",
        }}
      >
        {children}
      </div>
    </>
  );
}
