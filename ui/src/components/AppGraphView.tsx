// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { GitBranch } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppIcon from './AppIcon'
import EmptyState from './nebula/EmptyState'
import { statusLabel, statusTone } from '../services/irisApi'
import type { AppGraph, GraphEdge, GraphNode } from '../types'

const NODE_W = 132
const NODE_H = 88
const COL_GAP = 72
const ROW_GAP = 28
const PAD = 40

function nodeDepths(nodes: GraphNode[], edges: GraphEdge[]): Map<string, number> {
  const depths = new Map<string, number>()
  for (const node of nodes) depths.set(node.id, 0)

  let changed = true
  while (changed) {
    changed = false
    for (const edge of edges) {
      if (!edge.resolved) continue
      const fromDepth = depths.get(edge.from) ?? 0
      const toDepth = depths.get(edge.to) ?? 0
      const next = fromDepth + 1
      if (next > toDepth) {
        depths.set(edge.to, next)
        changed = true
      }
    }
  }
  return depths
}

function layoutNodes(nodes: GraphNode[], edges: GraphEdge[]) {
  const depths = nodeDepths(nodes, edges)
  const columns = new Map<number, GraphNode[]>()
  for (const node of nodes) {
    const depth = depths.get(node.id) ?? 0
    const col = columns.get(depth) ?? []
    col.push(node)
    columns.set(depth, col)
  }

  const positions = new Map<string, { x: number; y: number }>()
  const sortedDepths = [...columns.keys()].sort((a, b) => a - b)
  let maxRows = 1
  for (const depth of sortedDepths) {
    const col = columns.get(depth) ?? []
    col.sort((a, b) => a.label.localeCompare(b.label))
    maxRows = Math.max(maxRows, col.length)
    col.forEach((node, row) => {
      positions.set(node.id, {
        x: PAD + depth * (NODE_W + COL_GAP),
        y: PAD + row * (NODE_H + ROW_GAP),
      })
    })
  }

  const width = PAD * 2 + (sortedDepths.length || 1) * NODE_W + Math.max(0, sortedDepths.length - 1) * COL_GAP
  const height = PAD * 2 + maxRows * NODE_H + Math.max(0, maxRows - 1) * ROW_GAP
  return { positions, width, height }
}

interface AppGraphViewProps {
  graph: AppGraph
  focusId?: string
  onNodeClick?: (appId: string) => void
  compact?: boolean
  galaxy?: boolean
}

function galaxyNodeClass(status: string): string {
  if (status === 'broken') return 'graph-node-broken'
  if (status === 'degraded') return 'graph-node-degraded'
  if (status === 'healthy') return 'graph-node-healthy'
  return ''
}

export default function AppGraphView({ graph, focusId, onNodeClick, compact, galaxy }: AppGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverId, setHoverId] = useState<string | null>(null)

  const { positions, width, height } = useMemo(
    () => layoutNodes(graph.nodes, graph.edges),
    [graph.nodes, graph.edges],
  )

  const activeId = hoverId ?? focusId ?? null
  const related = useMemo(() => {
    if (!activeId) return new Set<string>()
    const set = new Set<string>([activeId])
    for (const edge of graph.edges) {
      if (!edge.resolved) continue
      if (edge.from === activeId) set.add(edge.to)
      if (edge.to === activeId) set.add(edge.from)
    }
    return set
  }, [activeId, graph.edges])

  if (!graph.nodes.length) {
    return (
      <EmptyState
        icon={<GitBranch size={22} />}
        title="No published apps to graph yet"
        description="Publish services to the launchpad to see dependency links."
      />
    )
  }

  return (
    <div className={`app-graph-wrap${compact ? ' app-graph-compact' : ''}`} ref={containerRef}>
      <svg className="app-graph-edges" width={width} height={height} aria-hidden>
        {graph.edges.map((edge) => {
          if (!edge.resolved) return null
          const from = positions.get(edge.from)
          const to = positions.get(edge.to)
          if (!from || !to) return null
          const x1 = from.x + NODE_W
          const y1 = from.y + NODE_H / 2
          const x2 = to.x
          const y2 = to.y + NODE_H / 2
          const midX = (x1 + x2) / 2
          const dimmed = activeId && !related.has(edge.from) && !related.has(edge.to)
          return (
            <g key={`${edge.from}-${edge.to}-${edge.label}`} className={dimmed ? 'graph-edge-dim' : undefined}>
              <path
                d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                className="graph-edge-path"
              />
              <text x={midX} y={(y1 + y2) / 2 - 6} className="graph-edge-label">
                {edge.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="app-graph-nodes" style={{ width, height }}>
        {graph.nodes.map((node) => {
          const pos = positions.get(node.id)
          if (!pos) return null
          const dimmed = activeId && !related.has(node.id)
          const galaxyClass = galaxy ? galaxyNodeClass(node.status) : node.status !== 'healthy' ? 'graph-node-broken' : ''
          const className = `app-graph-node ${statusTone(node.status)} ${dimmed ? 'graph-node-dim' : ''} ${focusId === node.id ? 'graph-node-focus' : ''} ${galaxyClass}`.trim()
          const style = { left: pos.x, top: pos.y, width: NODE_W, height: NODE_H }
          const hoverProps = {
            onMouseEnter: () => setHoverId(node.id),
            onMouseLeave: () => setHoverId(null),
          }
          const inner = (
            <>
              <AppIcon icon={node.icon ?? 'app'} name={node.label} size="xs" />
              <strong>{node.label}</strong>
              <span className={`status-chip ${statusTone(node.status)}`}>{statusLabel(node.status)}</span>
              <span className="graph-node-ns">{node.namespace}</span>
            </>
          )
          if (onNodeClick) {
            return (
              <button
                key={node.id}
                type="button"
                className={className}
                style={style}
                {...hoverProps}
                onClick={() => onNodeClick(node.id)}
              >
                {inner}
              </button>
            )
          }
          return (
            <Link key={node.id} to={`/apps/${encodeURIComponent(node.id)}`} className={className} style={style} {...hoverProps}>
              {inner}
            </Link>
          )
        })}
      </div>
      {graph.edges.some((e) => !e.resolved) ? (
        <div className="graph-unresolved">
          <strong>Unresolved dependencies</strong>
          <ul>
            {graph.edges
              .filter((e) => !e.resolved)
              .map((e) => (
                <li key={`${e.to}-${e.label}`}>
                  {e.to.split('/').pop()} → {e.label}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
