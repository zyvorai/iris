// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useQuery } from '@tanstack/react-query'
import { hermesApi, actionLabel } from '../services/hermesApi'

export default function ActivityPage() {
  const audit = useQuery({
    queryKey: ['audit'],
    queryFn: () => hermesApi.listAudit(80),
    refetchInterval: 10000,
  })

  return (
    <section className="glass-section">
      <div className="section-head">
        <h2>Activity</h2>
        <span className="chip chip-muted">{audit.data?.length ?? 0} events</span>
      </div>
      {audit.isLoading ? (
        <div className="empty">Loading activity…</div>
      ) : audit.data?.length ? (
        <div className="audit-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>User</th>
                <th>App</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>
                    <span className="chip chip-muted">{actionLabel(event.action)}</span>
                  </td>
                  <td>{event.userId}</td>
                  <td>{event.appId || '—'}</td>
                  <td>{event.detail || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty">No activity yet. Launch apps, search, or pin favorites to populate the audit log.</div>
      )}
    </section>
  )
}
