.PHONY: build build-go build-rust build-ui test clean docker deploy-remote

VERSION ?= 0.1.0
REGISTRY ?= ghcr.io/ssahani/hermes
HERMES_HOST ?= 212.8.252.194
HERMES_USER ?= sus

deploy-remote:
	chmod +x scripts/deploy-remote.sh scripts/e2e-deploy-verify.sh
	./scripts/deploy-remote.sh $(HERMES_HOST) $(HERMES_USER) deploy

deploy-remote-verify:
	./scripts/deploy-remote.sh $(HERMES_HOST) $(HERMES_USER) --verify-only

deploy-remote-uninstall:
	./scripts/deploy-remote.sh $(HERMES_HOST) $(HERMES_USER) --uninstall

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
