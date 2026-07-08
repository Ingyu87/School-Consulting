import { LottiePlayer } from "./LottiePlayer";
import aiProcessingLoader from "../assets/ai-processing-loader.json";

export default function AiWaitingLottie({ className }: { className?: string }) {
  return <LottiePlayer animationData={aiProcessingLoader} className={className} label="AI 분석 대기" />;
}
