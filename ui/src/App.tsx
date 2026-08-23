// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import AppsPage from './pages/AppsPage'
import ClusterPage from './pages/ClusterPage'
import DiscoveryPage from './pages/DiscoveryPage'
import AppDetailPage, { HealthPage } from './pages/AppDetailPage'
import ActivityPage from './pages/ActivityPage'
import TeamsPage from './pages/TeamsPage'
import GraphPage from './pages/GraphPage'
import FederatedPage from './pages/FederatedPage'
import HelpPage from './pages/HelpPage'
import SpacesPage, { SpaceDetailPage } from './pages/SpacesPage'
import MissionControlPage from './pages/MissionControlPage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'
import { InspectorProvider } from './utils/inspectorContext'
import { SpotlightProvider } from './utils/spotlightContext'
import { useGlobalNavShortcuts } from './hooks/useGlobalNavShortcuts'

function AppRoutes() {
  useGlobalNavShortcuts()

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/apps" element={<AppsPage />} />
      <Route path="/cluster" element={<ClusterPage />} />
      <Route path="/graph" element={<GraphPage />} />
      <Route path="/federated" element={<FederatedPage />} />
      <Route path="/teams" element={<TeamsPage />} />
      <Route path="/apps/:id" element={<AppDetailPage />} />
      <Route path="/spaces" element={<SpacesPage />} />
      <Route path="/spaces/:spaceId" element={<SpaceDetailPage />} />
      <Route path="/discovery" element={<DiscoveryPage />} />
      <Route path="/health" element={<HealthPage />} />
      <Route path="/activity" element={<ActivityPage />} />
      <Route path="/mission-control" element={<MissionControlPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/help" element={<HelpPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <InspectorProvider>
      <SpotlightProvider>
        <Layout>
          <AppRoutes />
        </Layout>
      </SpotlightProvider>
    </InspectorProvider>
  )
}
