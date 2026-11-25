// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

package store

// statusEventsSchema is also created by iris-core (store_governance.rs), which
// reads the table; keep the two definitions in step.
const statusEventsSchema = `
CREATE TABLE IF NOT EXISTS status_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_status_events_app ON status_events(app_id, id);
`

const (
	// maxEventsPerApp bounds the history kept for one app.
	maxEventsPerApp = 500
	maxMessageLen   = 500
)

// StatusEvents returns the recorded statuses of one app, oldest first.
func (s *Store) StatusEvents(appID string) ([]string, error) {
	rows, err := s.db.Query(`SELECT status FROM status_events WHERE app_id = ? ORDER BY id`, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}

// recordStatus appends a status event when status differs from the app's last
// recorded one, and trims the oldest events beyond maxEventsPerApp.
func (s *Store) recordStatus(appID, status, message, at string) error {
	if status == "" {
		return nil
	}
	if r := []rune(message); len(r) > maxMessageLen {
		message = string(r[:maxMessageLen])
	}
	res, err := s.db.Exec(`
INSERT INTO status_events (app_id, status, message, at)
SELECT ?, ?, ?, ?
WHERE COALESCE((SELECT status FROM status_events WHERE app_id = ? ORDER BY id DESC LIMIT 1), '') <> ?`,
		appID, status, message, at, appID, status)
	if err != nil {
		return err
	}
	if n, err := res.RowsAffected(); err != nil || n == 0 {
		return err
	}
	_, err = s.db.Exec(`
DELETE FROM status_events
WHERE app_id = ? AND id <= (
  SELECT id FROM status_events WHERE app_id = ? ORDER BY id DESC LIMIT 1 OFFSET ?)`,
		appID, appID, maxEventsPerApp)
	return err
}
