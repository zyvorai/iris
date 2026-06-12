// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { actionLabel, hermesApi } from '../../services/hermesApi'

export default function HomeActivityFeed() {
  const audit = useQuery({ queryKey: ['audit-recent-home'], queryFn: () => hermesApi.listAudit(10), refetchInterval: 30000 })

  if (!audit.data?.length) return null

  return (
    <section className="glass-section home-activity-feed" data-testid="home-activity-feed">
      <div className="section-head">
        <h2>
          <History size={16} /> Live Activity
        </h2>
        <Link to="/activity" className="section-link">
          Full audit log
        </Link>
      </div>
      <ul className="home-activity-list">
        {audit.data.map((evt) => (
          <li key={evt.id}>
            <span className="home-activity-action">{actionLabel(evt.action)}</span>
            <span className="home-activity-detail">{evt.detail || evt.appId || 'cluster'}</span>
            <time>{new Date(evt.createdAt).toLocaleString()}</time>
          </li>
        ))}
      </ul>
    </section>
  )
}
