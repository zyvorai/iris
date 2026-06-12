// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

import { useCallback, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import AppsPage from './pages/AppsPage'
import ClusterPage from './pages/ClusterPage'
import DiscoveryPage from './pages/DiscoveryPage'
import AppDetailPage, { HealthPage } from './pages/AppDetailPage'
import ActivityPage from './pages/ActivityPage'
import GraphPage from './pages/GraphPage'
import SpacesPage, { SpaceDetailPage } from './pages/SpacesPage'

export default function App() {
  const [paletteOpen, setPaletteOpen] = useState(false)

  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      setPaletteOpen(true)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  return (
    <Layout
      paletteOpen={paletteOpen}
      onPaletteOpen={() => setPaletteOpen(true)}
      onPaletteClose={() => setPaletteOpen(false)}
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/apps" element={<AppsPage />} />
        <Route path="/cluster" element={<ClusterPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/apps/:id" element={<AppDetailPage />} />
        <Route path="/spaces" element={<SpacesPage />} />
        <Route path="/spaces/:spaceId" element={<SpaceDetailPage />} />
        <Route path="/discovery" element={<DiscoveryPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/activity" element={<ActivityPage />} />
      </Routes>
    </Layout>
  )
}
