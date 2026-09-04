// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

interface GroupByOption {
  value: string
  label: string
}

interface GroupBySelectProps {
  value: string
  onChange: (value: string) => void
  options: GroupByOption[]
}

export default function GroupBySelect({ value, onChange, options }: GroupBySelectProps) {
  return (
    <select
      className="page-toolbar-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Group apps"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
