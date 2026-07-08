import { LottiePlayer } from "./LottiePlayer";
import generationComplete from "../assets/generation-complete.json";

export default function CompletionLottie({ className }: { className?: string }) {
  return <LottiePlayer animationData={generationComplete} className={className} label="생성 완료" loop={false} />;
}
