// Copyright (c) 2026 ZyvorAI Labs Private Limited. All rights reserved.
// https://zyvor.dev · info@zyvor.dev

use std::fs;
use std::path::Path;

use anyhow::Context;
use axum_server::tls_rustls::RustlsConfig;

/// Resolve the TLS configuration hermes-server binds with.
///
/// Prefers an operator-supplied cert/key (`HERMES_TLS_CERT` / `HERMES_TLS_KEY`).
/// Otherwise reuses (or generates) a self-signed certificate under `self_signed_dir`
/// so restarts don't mint a new cert — and a new browser trust warning — every time.
pub async fn resolve(
    cert_path: Option<String>,
    key_path: Option<String>,
    self_signed_dir: &Path,
    san_hosts: &[String],
) -> anyhow::Result<RustlsConfig> {
    if let (Some(cert), Some(key)) = (cert_path, key_path) {
        tracing::info!("loading TLS certificate from {cert}");
        return RustlsConfig::from_pem_file(&cert, &key)
            .await
            .with_context(|| format!("load TLS cert/key from {cert} / {key}"));
    }

    let cert_file = self_signed_dir.join("cert.pem");
    let key_file = self_signed_dir.join("key.pem");
    if cert_file.exists() && key_file.exists() {
        tracing::info!("reusing self-signed TLS certificate in {}", self_signed_dir.display());
    } else {
        fs::create_dir_all(self_signed_dir)
            .with_context(|| format!("create TLS directory {}", self_signed_dir.display()))?;
        let (cert_pem, key_pem) = generate_self_signed(san_hosts)?;
        fs::write(&cert_file, cert_pem).context("write self-signed certificate")?;
        fs::write(&key_file, key_pem).context("write self-signed private key")?;
        tracing::warn!(
            "HERMES_TLS_CERT/HERMES_TLS_KEY not set — generated a self-signed certificate at {} \
             (browsers will show a trust warning until a real certificate is supplied)",
            self_signed_dir.display()
        );
    }

    RustlsConfig::from_pem_file(&cert_file, &key_file)
        .await
        .context("load self-signed TLS certificate")
}

fn generate_self_signed(san_hosts: &[String]) -> anyhow::Result<(Vec<u8>, Vec<u8>)> {
    let mut names = vec!["localhost".to_string(), "127.0.0.1".to_string()];
    for host in san_hosts {
        let host = host.trim();
        if !host.is_empty() && !names.iter().any(|n| n == host) {
            names.push(host.to_string());
        }
    }
    let certified =
        rcgen::generate_simple_self_signed(names).context("generate self-signed certificate")?;
    Ok((
        certified.cert.pem().into_bytes(),
        certified.signing_key.serialize_pem().into_bytes(),
    ))
}
