import { HeaderPreview }     from './BlockHeader'
import { PhasesPreview }     from './BlockPhases'
import { InvestmentPreview } from './BlockInvestment'
import {
  AttachmentsPreview,
  CustomPreview,
  NextStepsPreview,
  TermsPreview,
} from './BlockExtraPreviews'
import type { ProposalBlock } from '@/lib/proposal-types'
import type {
  BlockContentAttachments,
  BlockContentCustom,
  BlockContentInvestment,
  BlockContentNextSteps,
  BlockContentTerms,
} from '@/lib/proposal-types'

/** Renders a block in clean read-only mode for the document / public view. */
export function BlockReadOnly({ block }: { block: ProposalBlock }) {
  switch (block.type) {
    case 'header':
      return <HeaderPreview content={block.content as { body: string }} />
    case 'phases':
      return <PhasesPreview content={block.content as { phases: never[] }} />
    case 'investment':
      return <InvestmentPreview content={block.content as BlockContentInvestment} />
    case 'terms':
      return <TermsPreview content={block.content as BlockContentTerms} />
    case 'next_steps':
      return <NextStepsPreview content={block.content as BlockContentNextSteps} />
    case 'custom':
      return <CustomPreview content={block.content as BlockContentCustom} />
    case 'attachments':
      return <AttachmentsPreview content={block.content as BlockContentAttachments} />
    default:
      return null
  }
}
