// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

package store

import (
	"database/sql"
	"encoding/json"
	"strings"
	"time"

	_ "modernc.org/sqlite"
	"github.com/ssahani/hermes/controller/model"
)

type Store struct {
	db *sql.DB
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, err
	}
	s := &Store{db: db}
	if err := s.migrate(); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

func (s *Store) migrate() error {
	schema := `
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  namespace TEXT NOT NULL,
  category TEXT DEFAULT 'Custom',
  icon TEXT DEFAULT 'app',
  backend_json TEXT NOT NULL,
  route_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  status_message TEXT DEFAULT '',
  source TEXT NOT NULL,
  auth_mode TEXT DEFAULT 'none',
  score INTEGER DEFAULT 0,
  visibility_json TEXT NOT NULL,
  rewrite_json TEXT DEFAULT '{}',
  ready_endpoints INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_apps_namespace ON apps(namespace);
CREATE INDEX IF NOT EXISTS idx_apps_published ON apps(json_extract(visibility_json, '$.published'));
CREATE TABLE IF NOT EXISTS favorites (
  user_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, app_id)
);
CREATE TABLE IF NOT EXISTS recents (
  user_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  PRIMARY KEY (user_id, app_id)
);
CREATE TABLE IF NOT EXISTS hidden_services (
  namespace TEXT NOT NULL,
  service_name TEXT NOT NULL,
  PRIMARY KEY (namespace, service_name)
);
`
	_, err := s.db.Exec(schema)
	if err != nil {
		return err
	}
	_, _ = s.db.Exec(`ALTER TABLE apps ADD COLUMN canonical_slug TEXT DEFAULT ''`)
	_, _ = s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_apps_canonical_slug ON apps(canonical_slug)`)
	_, _ = s.db.Exec(`ALTER TABLE apps ADD COLUMN meta_json TEXT DEFAULT '{}'`)
	_, _ = s.db.Exec(`ALTER TABLE apps ADD COLUMN diagnosis_json TEXT DEFAULT ''`)
	_, _ = s.db.Exec(`
CREATE TABLE IF NOT EXISTS share_links (
  token TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  label TEXT DEFAULT ''
)`)
	_, _ = s.db.Exec(`CREATE INDEX IF NOT EXISTS idx_share_links_app ON share_links(app_id)`)
	return nil
}

const appSelectCols = `id, slug, canonical_slug, display_name, description, namespace, category, icon,
  backend_json, route_path, public_url, status, status_message, source,
  auth_mode, score, visibility_json, rewrite_json, ready_endpoints, updated_at, meta_json`

func (s *Store) UpsertApp(app model.App) error {
	now := time.Now().UTC().Format(time.RFC3339)
	app.UpdatedAt = now
	_, err := s.db.Exec(`
INSERT INTO apps (
  id, slug, canonical_slug, display_name, description, namespace, category, icon,
  backend_json, route_path, public_url, status, status_message, source,
  auth_mode, score, visibility_json, rewrite_json, ready_endpoints, updated_at, meta_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  slug=excluded.slug,
  canonical_slug=excluded.canonical_slug,
  display_name=excluded.display_name,
  description=excluded.description,
  namespace=excluded.namespace,
  category=excluded.category,
  icon=excluded.icon,
  backend_json=excluded.backend_json,
  route_path=excluded.route_path,
  public_url=excluded.public_url,
  status=excluded.status,
  status_message=excluded.status_message,
  source=excluded.source,
  auth_mode=excluded.auth_mode,
  score=excluded.score,
  visibility_json=CASE
    WHEN json_extract(apps.visibility_json, '$.published') = 1
      THEN apps.visibility_json
    ELSE excluded.visibility_json
  END,
  rewrite_json=excluded.rewrite_json,
  ready_endpoints=excluded.ready_endpoints,
  updated_at=excluded.updated_at,
  meta_json=CASE
    WHEN json_extract(excluded.meta_json, '$.recommended') = 1 THEN excluded.meta_json
    WHEN json_extract(apps.meta_json, '$.recommended') = 1 THEN json_set(excluded.meta_json, '$.recommended', json('true'))
    WHEN length(coalesce(json_extract(excluded.meta_json, '$.owner'), '')) > 0 THEN excluded.meta_json
    WHEN length(coalesce(json_extract(apps.meta_json, '$.owner'), '')) > 0 THEN json_set(excluded.meta_json, '$.owner', json_extract(apps.meta_json, '$.owner'))
    WHEN length(coalesce(json_extract(excluded.meta_json, '$.ingressHosts'), '')) > 0 THEN excluded.meta_json
    WHEN length(coalesce(json_extract(apps.meta_json, '$.ingressHosts'), '')) > 0 THEN json_set(excluded.meta_json, '$.ingressHosts', json_extract(apps.meta_json, '$.ingressHosts'))
    WHEN length(coalesce(json_extract(excluded.meta_json, '$.meshRoutes'), '')) > 0 THEN excluded.meta_json
    WHEN length(coalesce(json_extract(apps.meta_json, '$.meshRoutes'), '')) > 0 THEN json_set(excluded.meta_json, '$.meshRoutes', json_extract(apps.meta_json, '$.meshRoutes'))
    WHEN length(coalesce(json_extract(excluded.meta_json, '$.meshPolicies'), '')) > 0 THEN excluded.meta_json
    WHEN length(coalesce(json_extract(apps.meta_json, '$.meshPolicies'), '')) > 0 THEN json_set(excluded.meta_json, '$.meshPolicies', json_extract(apps.meta_json, '$.meshPolicies'))
    ELSE excluded.meta_json
  END
`,
		app.ID, app.Slug, app.CanonicalSlug, app.DisplayName, app.Description, app.Namespace, app.Category, app.Icon,
		app.BackendJSON(), app.RoutePath, app.PublicURL, app.Status, app.StatusMsg, app.Source,
		app.AuthMode, app.Score, app.VisibilityJSON(), app.RewriteJSON(), app.ReadyCount, app.UpdatedAt, app.MetaJSON(),
	)
	return err
}

func (s *Store) GetApp(id string) (*model.App, error) {
	row := s.db.QueryRow(`SELECT `+appSelectCols+` FROM apps WHERE id = ?`, id)
	return scanApp(row)
}

func (s *Store) ListApps(publishedOnly bool) ([]model.App, error) {
	q := `SELECT ` + appSelectCols + ` FROM apps`
	if publishedOnly {
		q += ` WHERE json_extract(visibility_json, '$.published') = 1 AND json_extract(visibility_json, '$.hidden') = 0`
	}
	q += ` ORDER BY display_name`
	rows, err := s.db.Query(q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var apps []model.App
	for rows.Next() {
		app, err := scanAppRows(rows)
		if err != nil {
			return nil, err
		}
		apps = append(apps, *app)
	}
	return apps, rows.Err()
}

func (s *Store) ListDiscovery() ([]model.App, error) {
	rows, err := s.db.Query(`
SELECT ` + appSelectCols + `
FROM apps
WHERE json_extract(visibility_json, '$.published') = 0
  AND json_extract(visibility_json, '$.hidden') = 0
ORDER BY score DESC, display_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var apps []model.App
	for rows.Next() {
		app, err := scanAppRows(rows)
		if err != nil {
			return nil, err
		}
		apps = append(apps, *app)
	}
	return apps, rows.Err()
}

func (s *Store) PublishApp(id string) error {
	vis := model.Visibility{Published: true}
	_, err := s.db.Exec(`UPDATE apps SET visibility_json = ?, updated_at = ? WHERE id = ?`,
		mustJSON(vis), time.Now().UTC().Format(time.RFC3339), id)
	return err
}

func (s *Store) PublishNamespace(namespace string) (int64, error) {
	res, err := s.db.Exec(`
UPDATE apps SET visibility_json = ?, updated_at = ?
WHERE namespace = ?
  AND json_extract(visibility_json, '$.hidden') = 0
  AND json_extract(visibility_json, '$.published') = 0`,
		mustJSON(model.Visibility{Published: true}),
		time.Now().UTC().Format(time.RFC3339),
		namespace,
	)
	if err != nil {
		return 0, err
	}
	return res.RowsAffected()
}

func (s *Store) DeleteApp(id string) error {
	_, err := s.db.Exec(`DELETE FROM apps WHERE id = ?`, id)
	return err
}

// PruneDiscoveredApps removes catalog rows whose Kubernetes Service no longer exists.
func (s *Store) PruneDiscoveredApps(keepIDs map[string]struct{}) (int, error) {
	apps, err := s.ListApps(false)
	if err != nil {
		return 0, err
	}
	pruned := 0
	for _, app := range apps {
		if app.Source == model.SourceManual {
			continue
		}
		if _, ok := keepIDs[app.ID]; ok {
			continue
		}
		if err := s.DeleteApp(app.ID); err != nil {
			return pruned, err
		}
		pruned++
	}
	return pruned, nil
}

func (s *Store) HideApp(id string) error {
	parts := strings.SplitN(id, "/", 2)
	if len(parts) == 2 {
		_ = s.HideService(parts[0], parts[1])
	}
	vis := model.Visibility{Hidden: true}
	_, err := s.db.Exec(`UPDATE apps SET visibility_json = ?, updated_at = ? WHERE id = ?`,
		mustJSON(vis), time.Now().UTC().Format(time.RFC3339), id)
	return err
}

func (s *Store) IsServiceHidden(ns, name string) (bool, error) {
	var count int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM hidden_services WHERE namespace = ? AND service_name = ?`, ns, name).Scan(&count)
	return count > 0, err
}

func (s *Store) HideService(ns, name string) error {
	_, err := s.db.Exec(`INSERT OR IGNORE INTO hidden_services (namespace, service_name) VALUES (?, ?)`, ns, name)
	return err
}

func (s *Store) UpdateDiagnosis(id string, diag model.AppDiagnosis) error {
	raw, err := json.Marshal(diag)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`UPDATE apps SET diagnosis_json = ?, updated_at = ? WHERE id = ?`,
		string(raw), time.Now().UTC().Format(time.RFC3339), id)
	return err
}

func scanApp(row *sql.Row) (*model.App, error) {
	var app model.App
	var backendJSON, visJSON, rewriteJSON, metaJSON string
	err := row.Scan(
		&app.ID, &app.Slug, &app.CanonicalSlug, &app.DisplayName, &app.Description, &app.Namespace, &app.Category, &app.Icon,
		&backendJSON, &app.RoutePath, &app.PublicURL, &app.Status, &app.StatusMsg, &app.Source,
		&app.AuthMode, &app.Score, &visJSON, &rewriteJSON, &app.ReadyCount, &app.UpdatedAt, &metaJSON,
	)
	if err != nil {
		return nil, err
	}
	app.Backend = model.ParseBackend(backendJSON)
	app.Visibility = model.ParseVisibility(visJSON)
	app.Rewrite = model.ParseRewrite(rewriteJSON)
	app.Meta = model.ParseMeta(metaJSON)
	return &app, nil
}

func scanAppRows(rows *sql.Rows) (*model.App, error) {
	var app model.App
	var backendJSON, visJSON, rewriteJSON, metaJSON string
	err := rows.Scan(
		&app.ID, &app.Slug, &app.CanonicalSlug, &app.DisplayName, &app.Description, &app.Namespace, &app.Category, &app.Icon,
		&backendJSON, &app.RoutePath, &app.PublicURL, &app.Status, &app.StatusMsg, &app.Source,
		&app.AuthMode, &app.Score, &visJSON, &rewriteJSON, &app.ReadyCount, &app.UpdatedAt, &metaJSON,
	)
	if err != nil {
		return nil, err
	}
	app.Backend = model.ParseBackend(backendJSON)
	app.Visibility = model.ParseVisibility(visJSON)
	app.Rewrite = model.ParseRewrite(rewriteJSON)
	app.Meta = model.ParseMeta(metaJSON)
	return &app, nil
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
