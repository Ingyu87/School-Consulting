import { useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web/build/player/lottie_light";

type LottiePlayerProps = {
  animationData: object;
  className?: string;
  label: string;
  loop?: boolean;
};

export function LottiePlayer({ animationData, className, label, loop = true }: LottiePlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const animation: AnimationItem = lottie.loadAnimation({
      container: containerRef.current,
      renderer: "svg",
      loop,
      autoplay: true,
      animationData
    });
    return () => animation.destroy();
  }, [animationData, loop]);

  return <div ref={containerRef} className={className} role="img" aria-label={label} />;
}
