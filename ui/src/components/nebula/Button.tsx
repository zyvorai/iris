// Copyright 2026 ZyvorAI Labs Private Limited
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ai'

interface BaseProps {
  variant?: ButtonVariant
  className?: string
  children: ReactNode
}

type ButtonProps = BaseProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined; to?: undefined }

type LinkProps = BaseProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; to?: undefined }

type RouterLinkProps = BaseProps & { to: string; href?: undefined }

export default function Button(props: ButtonProps | LinkProps | RouterLinkProps) {
  const { variant = 'secondary', className = '', children } = props
  const cls = `nebula-btn nebula-btn-${variant} ${className}`.trim()

  if ('to' in props && props.to) {
    const { to, variant: _v, className: _c, children: _ch, ...rest } = props
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    )
  }

  if ('href' in props && props.href) {
    const { href, variant: _v, className: _c, children: _ch, ...rest } = props as LinkProps
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    )
  }

  const { variant: _v, className: _c, children: _ch, ...rest } = props as ButtonProps
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  )
}
