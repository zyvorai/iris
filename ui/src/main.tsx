// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { WorkspaceProvider } from './utils/workspaceContext'
import { applyShellPreferencesOnBoot } from './utils/hermesShellPreferences'
import './styles/fonts.css'
import './styles/nebula-tokens.css'
import './styles/nebula-layout.css'
import './styles/hs-primitives.css'
import './styles/nebula-components.css'
import './index.css'
import './styles/axiom-bridge.css'

applyShellPreferencesOnBoot()

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <WorkspaceProvider>
          <App />
        </WorkspaceProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
