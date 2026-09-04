.PHONY: build build-go build-rust build-ui test clean docker \
	deploy-remote deploy-all-remote deploy-remote-verify deploy-remote-uninstall \
	test-remote-smoke test-remote-quick test-remote-all test-platform-remote

VERSION ?= 0.2.0
REGISTRY ?= ghcr.io/zyvorai/iris
DEPLOY_HOST ?=
DEPLOY_USER ?=
IRIS_HOST ?= $(DEPLOY_HOST)
IRIS_USER ?= $(DEPLOY_USER)

deploy-remote:
	@test -n "$(IRIS_HOST)" || (echo "Set IRIS_HOST=<host> (and IRIS_USER=<user>)" >&2; exit 1)
	@test -n "$(IRIS_USER)" || (echo "Set IRIS_USER=<user>" >&2; exit 1)
	chmod +x scripts/deploy-remote.sh scripts/e2e-deploy-verify.sh \
		scripts/lib/resolve-zyvor-sibling.sh 2>/dev/null || true
	./scripts/deploy-remote.sh $(IRIS_HOST) $(IRIS_USER)

deploy-all-remote:
	@test -n "$(IRIS_HOST)" || (echo "Set IRIS_HOST=<host> (and IRIS_USER=<user>)" >&2; exit 1)
	@test -n "$(IRIS_USER)" || (echo "Set IRIS_USER=<user>" >&2; exit 1)
	chmod +x scripts/deploy-all-remote.sh scripts/deploy-remote.sh \
		scripts/e2e-deploy-verify.sh scripts/lib/resolve-zyvor-sibling.sh 2>/dev/null || true
	./scripts/deploy-all-remote.sh $(IRIS_HOST) $(IRIS_USER)

deploy-remote-verify:
	@test -n "$(IRIS_HOST)" || (echo "Set IRIS_HOST=<host> (and IRIS_USER=<user>)" >&2; exit 1)
	@test -n "$(IRIS_USER)" || (echo "Set IRIS_USER=<user>" >&2; exit 1)
	chmod +x scripts/deploy-remote.sh 2>/dev/null || true
	./scripts/deploy-remote.sh $(IRIS_HOST) $(IRIS_USER) --verify-only

deploy-remote-uninstall:
	@test -n "$(IRIS_HOST)" || (echo "Set IRIS_HOST=<host> (and IRIS_USER=<user>)" >&2; exit 1)
	@test -n "$(IRIS_USER)" || (echo "Set IRIS_USER=<user>" >&2; exit 1)
	chmod +x scripts/deploy-remote.sh 2>/dev/null || true
	./scripts/deploy-remote.sh $(IRIS_HOST) $(IRIS_USER) --uninstall

test-remote-smoke:
	@test -n "$(DEPLOY_HOST)" || (echo "Set DEPLOY_HOST=<host> DEPLOY_USER=<user>" >&2; exit 1)
	@test -n "$(DEPLOY_USER)" || (echo "Set DEPLOY_USER=<user>" >&2; exit 1)
	chmod +x scripts/test-all-features-remote.sh scripts/e2e-deploy-verify.sh 2>/dev/null || true
	@IRIS_TEST_TIERS=smoke ./scripts/test-all-features-remote.sh $(DEPLOY_HOST) $(DEPLOY_USER)

test-remote-quick:
	@test -n "$(DEPLOY_HOST)" || (echo "Set DEPLOY_HOST=<host> DEPLOY_USER=<user>" >&2; exit 1)
	@test -n "$(DEPLOY_USER)" || (echo "Set DEPLOY_USER=<user>" >&2; exit 1)
	chmod +x scripts/test-all-features-remote.sh scripts/e2e-deploy-verify.sh 2>/dev/null || true
	@IRIS_TEST_TIERS=quick ./scripts/test-all-features-remote.sh $(DEPLOY_HOST) $(DEPLOY_USER)

test-remote-all:
	@test -n "$(DEPLOY_HOST)" || (echo "Set DEPLOY_HOST=<host> DEPLOY_USER=<user>" >&2; exit 1)
	@test -n "$(DEPLOY_USER)" || (echo "Set DEPLOY_USER=<user>" >&2; exit 1)
	chmod +x scripts/test-all-features-remote.sh scripts/e2e-deploy-verify.sh \
		scripts/deploy-remote.sh 2>/dev/null || true
	@IRIS_TEST_TIERS=full ./scripts/test-all-features-remote.sh $(DEPLOY_HOST) $(DEPLOY_USER)

test-platform-remote:
	@test -n "$(DEPLOY_HOST)" || (echo "Set DEPLOY_HOST=<host> DEPLOY_USER=<user>" >&2; exit 1)
	@test -n "$(DEPLOY_USER)" || (echo "Set DEPLOY_USER=<user>" >&2; exit 1)
	chmod +x scripts/test-platform-remote.sh scripts/lib/resolve-zyvor-sibling.sh 2>/dev/null || true
	@AXIOM_TEST_TIERS=full IRIS_TEST_TIERS=full ./scripts/test-platform-remote.sh $(DEPLOY_HOST) $(DEPLOY_USER)

build: build-go build-rust build-ui

build-go:
	cd cmd/iris-controller && go build -o ../../bin/iris-controller .

build-rust:
	cargo build --release -p iris-server
	cp target/release/iris-server bin/iris-server 2>/dev/null || cp target/release/iris-server bin/

build-ui:
	cd ui && npm ci && npm run build

test:
	cd cmd/iris-controller && go test ./...
	cargo test --workspace
	cd ui && npm test --if-present

clean:
	rm -rf bin/ ui/dist/ target/

docker:
	docker build -f Dockerfile.controller -t $(REGISTRY)/controller:$(VERSION) .
	docker build -f Dockerfile.server -t $(REGISTRY)/server:$(VERSION) .

helm-template:
	helm template iris ./charts/iris --set global.domain=zeus.local
