import { useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web/build/player/lottie_light";

type LottiePlayerProps = {
  animationData: object;
  className?: string;
  label?: string;
};

export function LottiePlayer({ animationData, className, label }: LottiePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const animation: AnimationItem = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData
    });

    return () => animation.destroy();
  }, [animationData]);

  return <div ref={containerRef} className={className} aria-label={label} role={label ? "img" : undefined} />;
}
