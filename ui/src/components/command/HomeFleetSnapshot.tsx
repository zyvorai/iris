// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { Link } from 'react-router-dom'

interface HomeFleetSnapshotProps {
  serviceCount: number
  publishedCount: number
  namespaceCount: number
  issueCount: number
  brokenCount: number
}

export default function HomeFleetSnapshot({
  serviceCount,
  publishedCount,
  namespaceCount,
  issueCount,
  brokenCount,
}: HomeFleetSnapshotProps) {
  const unpublished = Math.max(0, serviceCount - publishedCount)

  return (
    <ul className="hs-stats" data-testid="home-metrics-strip">
      <li>
        <Link to="/cluster">
          <p className="hs-stats-value">{serviceCount}</p>
          <p className="hs-stats-label">Discovered</p>
          <p className="hs-stats-sub">{namespaceCount} namespaces</p>
        </Link>
      </li>
      <li>
        <Link to="/apps">
          <p className="hs-stats-value">{publishedCount}</p>
          <p className="hs-stats-label">Published</p>
          <p className="hs-stats-sub">
            {unpublished > 0 ? `${unpublished} awaiting publish` : 'Launchpad ready'}
          </p>
        </Link>
      </li>
      <li>
        <Link to="/health">
          <p className={`hs-stats-value${issueCount > 0 ? ' is-alert' : ''}`}>{issueCount}</p>
          <p className="hs-stats-label">Needs attention</p>
          <p className="hs-stats-sub">
            {brokenCount > 0 ? `${brokenCount} broken` : issueCount > 0 ? 'Degraded services' : 'All clear'}
          </p>
        </Link>
      </li>
    </ul>
  )
}
