// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

package model

type DiagnosisChainNode struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Status string `json:"status,omitempty"`
}

type SuggestedAction struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

type AppDiagnosis struct {
	AppID            string               `json:"appId"`
	RoutePath        string               `json:"routePath"`
	PublicURL        string               `json:"publicUrl"`
	Backend          Backend              `json:"backend"`
	Problem          string               `json:"problem,omitempty"`
	Cause            string               `json:"cause,omitempty"`
	Chain            []DiagnosisChainNode `json:"chain"`
	SuggestedActions []SuggestedAction    `json:"suggestedActions"`
}
