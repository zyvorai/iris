// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import type { CSSProperties, ReactNode } from 'react'

/** Departures-board column labels — same grid-template-columns as .dep rows
 * (chit, service, status, destination, actions) so the header aligns. */
export function BoardHead() {
  return (
    <div className="board-hd" aria-hidden>
      <span />
      <span>Service</span>
      <span>Status</span>
      <span>Destination</span>
      <span />
    </div>
  )
}

interface BoardProps {
  children: ReactNode
  style?: CSSProperties
}

/** Wraps a flat list of DeparturesRow children with the board-hd label row.
 * CollapsibleGroup renders its own header inline for grouped views. */
export default function Board({ children, style }: BoardProps) {
  return (
    <div className="board" style={style}>
      <BoardHead />
      {children}
    </div>
  )
}
