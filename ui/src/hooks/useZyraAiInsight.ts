// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { useQuery } from '@tanstack/react-query'
import { irisApi } from '../services/irisApi'

export function useZyraAiInsight(appId: string | null, enabled = true) {
  const insight = useQuery({
    queryKey: ['app-insight', appId],
    queryFn: () => irisApi.getAppInsight(appId!),
    enabled: enabled && !!appId,
    staleTime: 60_000,
  })

  return {
    insight,
    summary: insight.data?.summary ?? '',
    explanation:
      insight.data?.explanation ??
      (insight.isLoading ? 'Zyra AI is analyzing this service…' : 'No insight available yet.'),
    remediation: insight.data?.remediation ?? [],
    suggestedActions: insight.data?.suggestedActions ?? [],
    source: insight.data?.source,
    loading: insight.isLoading,
  }
}

export function useFleetInsight(enabled = true) {
  return useQuery({
    queryKey: ['fleet-insight'],
    queryFn: irisApi.getFleetInsight,
    enabled,
    staleTime: 45_000,
    refetchInterval: 60_000,
  })
}

export function useDiscoveryInsight(enabled = true) {
  return useQuery({
    queryKey: ['discovery-insight'],
    queryFn: irisApi.getDiscoveryInsight,
    enabled,
    staleTime: 45_000,
    refetchInterval: 60_000,
  })
}

export function useNamespaceInsight(namespace: string | null, enabled = true) {
  return useQuery({
    queryKey: ['namespace-insight', namespace],
    queryFn: () => irisApi.getNamespaceInsight(namespace!),
    enabled: enabled && !!namespace,
    staleTime: 45_000,
  })
}

export function useGraphInsight(enabled = true) {
  return useQuery({
    queryKey: ['graph-insight'],
    queryFn: irisApi.getGraphInsight,
    enabled,
    staleTime: 45_000,
    refetchInterval: 60_000,
  })
}

export function useOwnerInsight(owner: string | null, enabled = true) {
  return useQuery({
    queryKey: ['owner-insight', owner],
    queryFn: () => irisApi.getOwnerInsight(owner!),
    enabled: enabled && !!owner,
    staleTime: 45_000,
  })
}

export function useAiStatus() {
  return useQuery({
    queryKey: ['ai-status'],
    queryFn: irisApi.getAiStatus,
    staleTime: 60_000,
  })
}

export function useFederatedInsight(enabled = true) {
  return useQuery({
    queryKey: ['federated-insight'],
    queryFn: irisApi.getFederatedInsight,
    enabled,
    staleTime: 45_000,
    refetchInterval: 60_000,
  })
}

export function useActivityInsight(enabled = true) {
  return useQuery({
    queryKey: ['activity-insight'],
    queryFn: irisApi.getActivityInsight,
    enabled,
    staleTime: 45_000,
    refetchInterval: 60_000,
  })
}
