import { dealStageClass, formatDealStage } from "@/lib/deals"

export default function DealStageBadge({ stage }: { stage: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dealStageClass(stage)}`}>
      {formatDealStage(stage)}
    </span>
  )
}
