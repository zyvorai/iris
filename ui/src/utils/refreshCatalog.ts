// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import type { QueryClient } from '@tanstack/react-query'

export async function refreshHermesData(qc: QueryClient) {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['catalog'] }),
    qc.invalidateQueries({ queryKey: ['apps'] }),
    qc.invalidateQueries({ queryKey: ['discovery'] }),
    qc.invalidateQueries({ queryKey: ['cluster-summary'] }),
    qc.invalidateQueries({ queryKey: ['health'] }),
    qc.invalidateQueries({ queryKey: ['graph'] }),
    qc.invalidateQueries({ queryKey: ['favorites'] }),
    qc.invalidateQueries({ queryKey: ['recents'] }),
    qc.invalidateQueries({ queryKey: ['recommended'] }),
    qc.invalidateQueries({ queryKey: ['workspaces'] }),
    qc.invalidateQueries({ queryKey: ['clusters'] }),
    qc.invalidateQueries({ queryKey: ['audit-recent'] }),
    qc.invalidateQueries({ queryKey: ['audit'] }),
  ])
}
