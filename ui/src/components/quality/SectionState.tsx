// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

interface QueryLike {
  isLoading: boolean
  isError: boolean
  error: unknown
}

/** Shared loading and error line for the independent sections of a page. */
export default function SectionState({ query, name }: { query: QueryLike; name: string }) {
  if (query.isError) {
    return (
      <p className="body-text" role="alert">
        Could not load {name}: {query.error instanceof Error ? query.error.message : 'request failed'}
      </p>
    )
  }
  return query.isLoading ? <p className="body-text">Loading {name}…</p> : null
}
