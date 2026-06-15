import { Badge } from "@/components/ui/badge"
import { dealStageClass, formatDealStage } from "@/lib/deals"

export default function DealStageBadge({ stage }: { stage: string }) {
  return (
    <Badge variant="outline" className={`border-transparent ${dealStageClass(stage)}`}>
      {formatDealStage(stage)}
    </Badge>
  )
}
