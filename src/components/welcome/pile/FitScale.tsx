import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Its content scaled down to fit the space it is given, never up: the whole
 * month shows whatever the phone's height.
 */
export default function FitScale({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const b = box.current;
    const i = inner.current;
    if (!b || !i) return;
    const fit = () =>
      setScale(Math.min(1, b.clientHeight / i.offsetHeight, b.clientWidth / i.offsetWidth));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(b);
    observer.observe(i);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={box} className="relative h-full w-full">
      <div
        ref={inner}
        className="absolute left-1/2 top-0 w-full max-w-[380px]"
        style={{ transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}
      >
        {children}
      </div>
    </div>
  );
}
