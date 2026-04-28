import { HeaderPreview }     from './BlockHeader'
import { PhasesPreview }     from './BlockPhases'
import { InvestmentPreview } from './BlockInvestment'
import type { ProposalBlock }        from '@/lib/proposal-types'
import type { BlockContentInvestment } from '@/lib/proposal-types'

/** Renders a block in clean read-only mode for the document / visualizar view. */
export function BlockReadOnly({ block }: { block: ProposalBlock }) {
  switch (block.type) {
    case 'header':
      return <HeaderPreview content={block.content as { body: string }} />
    case 'phases':
      return <PhasesPreview content={block.content as { phases: never[] }} />
    case 'investment':
      return <InvestmentPreview content={block.content as BlockContentInvestment} />
    default:
      return null
  }
}
