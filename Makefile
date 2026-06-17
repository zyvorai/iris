.PHONY: build build-go build-rust build-ui test clean docker \
	deploy-remote deploy-all-remote deploy-remote-verify deploy-remote-uninstall \
	test-remote-smoke test-remote-quick test-remote-all test-platform-remote

VERSION ?= 0.2.0
REGISTRY ?= ghcr.io/ssahani/hermes
DEPLOY_HOST ?= 212.8.252.194
DEPLOY_USER ?= sus
HERMES_HOST ?= $(DEPLOY_HOST)
HERMES_USER ?= $(DEPLOY_USER)

deploy-remote:
	chmod +x scripts/deploy-remote.sh scripts/e2e-deploy-verify.sh \
		scripts/lib/resolve-zyvor-sibling.sh 2>/dev/null || true
	./scripts/deploy-remote.sh $(HERMES_HOST) $(HERMES_USER)

deploy-all-remote:
	chmod +x scripts/deploy-all-remote.sh scripts/deploy-remote.sh \
		scripts/e2e-deploy-verify.sh scripts/lib/resolve-zyvor-sibling.sh 2>/dev/null || true
	./scripts/deploy-all-remote.sh $(HERMES_HOST) $(HERMES_USER)

deploy-remote-verify:
	chmod +x scripts/deploy-remote.sh 2>/dev/null || true
	./scripts/deploy-remote.sh $(HERMES_HOST) $(HERMES_USER) --verify-only

deploy-remote-uninstall:
	chmod +x scripts/deploy-remote.sh 2>/dev/null || true
	./scripts/deploy-remote.sh $(HERMES_HOST) $(HERMES_USER) --uninstall

test-remote-smoke:
	chmod +x scripts/test-all-features-remote.sh scripts/e2e-deploy-verify.sh 2>/dev/null || true
	@HERMES_TEST_TIERS=smoke ./scripts/test-all-features-remote.sh $(DEPLOY_HOST) $(DEPLOY_USER)

test-remote-quick:
	chmod +x scripts/test-all-features-remote.sh scripts/e2e-deploy-verify.sh 2>/dev/null || true
	@HERMES_TEST_TIERS=quick ./scripts/test-all-features-remote.sh $(DEPLOY_HOST) $(DEPLOY_USER)

test-remote-all:
	chmod +x scripts/test-all-features-remote.sh scripts/e2e-deploy-verify.sh \
		scripts/deploy-remote.sh 2>/dev/null || true
	@HERMES_TEST_TIERS=full ./scripts/test-all-features-remote.sh $(DEPLOY_HOST) $(DEPLOY_USER)

test-platform-remote:
	chmod +x scripts/test-platform-remote.sh scripts/lib/resolve-zyvor-sibling.sh 2>/dev/null || true
	@AETHER_TEST_TIERS=full HERMES_TEST_TIERS=full ./scripts/test-platform-remote.sh $(DEPLOY_HOST) $(DEPLOY_USER)

build: build-go build-rust build-ui

build-go:
	cd cmd/hermes-controller && go build -o ../../bin/hermes-controller .

build-rust:
	cargo build --release -p hermes-server
	cp target/release/hermes-server bin/hermes-server 2>/dev/null || cp target/release/hermes-server bin/

build-ui:
	cd ui && npm ci && npm run build

test:
	cd cmd/hermes-controller && go test ./...
	cargo test --workspace
	cd ui && npm test --if-present

clean:
	rm -rf bin/ ui/dist/ target/

docker:
	docker build -f Dockerfile.controller -t $(REGISTRY)/controller:$(VERSION) .
	docker build -f Dockerfile.server -t $(REGISTRY)/server:$(VERSION) .

helm-template:
	helm template hermes ./charts/hermes --set global.domain=zeus.local
