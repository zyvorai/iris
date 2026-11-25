// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
}

export function formatUptime(percent: number | undefined): string {
  return percent === undefined ? 'no data' : `${percent.toFixed(2)}%`
}

export const CONFORMANCE_RULES = [
  'owner-missing',
  'environment-missing',
  'description-missing',
  'runbook-missing',
  'lifecycle-missing',
  'tags-missing',
  'no-ready-endpoints',
  'dependency-cycle',
  'dependency-unresolved',
  'dependency-deprecated',
]
