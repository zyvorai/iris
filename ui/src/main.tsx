// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

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
import './styles/nebula-components.css'
import './index.css'
import './styles/aether-bridge.css'

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
