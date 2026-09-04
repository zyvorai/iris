// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, MoreHorizontal, RefreshCw, Rocket } from 'lucide-react'
import { Link } from 'react-router-dom'
import { irisApi } from '../../services/irisApi'
import { refreshIrisData } from '../../utils/refreshCatalog'

export default function QuickActionsMenu() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()
  const cluster = useQuery({ queryKey: ['cluster-summary'], queryFn: irisApi.clusterSummary })
  const discovery = useQuery({ queryKey: ['discovery'], queryFn: irisApi.listDiscovery })

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const refresh = useMutation({
    mutationFn: () => refreshIrisData(qc),
  })

  const exportCatalog = async () => {
    const blob = await irisApi.exportCatalog()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `iris-catalog-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  const unpublished = discovery.data?.length ?? cluster.data?.discovery ?? 0

  return (
    <div className="quick-actions-wrap" ref={rootRef}>
      <button type="button" className="iris-search-btn quick-actions-trigger" onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal size={16} />
        <span>Actions</span>
      </button>
      {open ? (
        <div className="quick-actions-menu zeus-glass" role="menu">
          <button type="button" role="menuitem" disabled={refresh.isPending} onClick={() => void refresh.mutate()}>
            <RefreshCw size={14} /> {refresh.isPending ? 'Syncing…' : 'Refresh catalog'}
          </button>
          <button type="button" role="menuitem" onClick={() => void exportCatalog()}>
            <Download size={14} /> Export catalog JSON
          </button>
          <Link to="/discovery" className="quick-actions-link" role="menuitem" onClick={() => setOpen(false)}>
            <Rocket size={14} /> Discovery queue ({unpublished})
          </Link>
        </div>
      ) : null}
    </div>
  )
}
