// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useQuery } from '@tanstack/react-query'
import { hermesApi } from '../services/hermesApi'

export function useZeusAiInsight(appId: string | null, displayName: string, enabled = true) {
  const diagnosis = useQuery({
    queryKey: ['diagnosis', appId],
    queryFn: () => hermesApi.getDiagnosis(appId!),
    enabled: enabled && !!appId,
  })

  const llm = useQuery({
    queryKey: ['zeus-ai', appId, displayName],
    queryFn: () => hermesApi.searchLlm(`why is ${displayName} ${diagnosis.data?.problem ? 'having issues' : 'offline'}`),
    enabled: enabled && !!appId && !!displayName,
    staleTime: 60_000,
  })

  const explanation =
    diagnosis.data?.cause ||
    diagnosis.data?.problem ||
    llm.data?.answer ||
    (diagnosis.isLoading ? 'Analyzing service health…' : 'No insight available yet.')

  return {
    diagnosis,
    llm,
    explanation,
    suggestedActions: diagnosis.data?.suggestedActions ?? [],
    loading: diagnosis.isLoading || llm.isLoading,
  }
}
