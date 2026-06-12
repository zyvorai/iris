// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

package model

import "encoding/json"

const (
	StatusHealthy   = "healthy"
	StatusDegraded  = "degraded"
	StatusBroken    = "broken"
	StatusUnknown   = "unknown"
	StatusHidden    = "hidden"
	StatusSuggested = "suggested"

	SourceAnnotation = "annotation"
	SourceSignature  = "signature"
	SourceService    = "service"
	SourceIngress    = "ingress"
	SourceManual     = "manual"
)

type Backend struct {
	Kind   string `json:"kind"`
	Name   string `json:"name"`
	Port   int    `json:"port"`
	Scheme string `json:"scheme"`
	Path   string `json:"path"`
}

type Visibility struct {
	Published bool `json:"published"`
	Hidden    bool `json:"hidden"`
	Favorite  bool `json:"favorite"`
}

type Rewrite struct {
	StripPrefix string `json:"stripPrefix,omitempty"`
	AddPrefix   string `json:"addPrefix,omitempty"`
}

type App struct {
	ID          string     `json:"id"`
	Slug        string     `json:"slug"`
	DisplayName string     `json:"displayName"`
	Description string     `json:"description,omitempty"`
	Namespace   string     `json:"namespace"`
	Category    string     `json:"category"`
	Icon        string     `json:"icon"`
	Backend     Backend    `json:"backend"`
	RoutePath   string     `json:"routePath"`
	PublicURL   string     `json:"publicUrl"`
	Status      string     `json:"status"`
	StatusMsg   string     `json:"statusMessage,omitempty"`
	Source      string     `json:"source"`
	AuthMode    string     `json:"authMode"`
	Score       int        `json:"score"`
	Visibility  Visibility `json:"visibility"`
	Rewrite     Rewrite    `json:"rewrite,omitempty"`
	ReadyCount  int        `json:"readyEndpoints"`
	UpdatedAt   string     `json:"updatedAt"`
}

func (a App) BackendJSON() string {
	b, _ := json.Marshal(a.Backend)
	return string(b)
}

func (a App) VisibilityJSON() string {
	b, _ := json.Marshal(a.Visibility)
	return string(b)
}

func (a App) RewriteJSON() string {
	b, _ := json.Marshal(a.Rewrite)
	return string(b)
}

func ParseBackend(raw string) Backend {
	var b Backend
	_ = json.Unmarshal([]byte(raw), &b)
	return b
}

func ParseVisibility(raw string) Visibility {
	var v Visibility
	_ = json.Unmarshal([]byte(raw), &v)
	return v
}

func ParseRewrite(raw string) Rewrite {
	var r Rewrite
	_ = json.Unmarshal([]byte(raw), &r)
	return r
}
