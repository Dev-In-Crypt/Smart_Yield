.PHONY: install build test test-v coverage slither clean deploy

# ── Setup ─────────────────────────────────────────────────────────────────────
install:
	forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts

# ── Build ─────────────────────────────────────────────────────────────────────
build:
	forge build

# ── Tests ─────────────────────────────────────────────────────────────────────
test:
	forge test

test-v:
	forge test -vvv

# Run a single test by name pattern, e.g.: make test-match MATCH=test_Deposit
test-match:
	forge test --match-test $(MATCH) -vvv

# Run a single test file, e.g.: make test-file FILE=VaultManager
test-file:
	forge test --match-path test/$(FILE).t.sol -vvv

# ── Coverage ──────────────────────────────────────────────────────────────────
coverage:
	forge coverage --report lcov
	genhtml -o coverage-report lcov.info --branch-coverage

# ── Security ──────────────────────────────────────────────────────────────────
slither:
	slither . --config-file .slither.config.json

# ── Deploy ────────────────────────────────────────────────────────────────────
deploy:
	forge script script/Deploy.s.sol \
		--rpc-url $(RPC_URL) \
		--private-key $(PRIVATE_KEY) \
		--broadcast \
		--verify \
		--verifier-url $(INITIASCAN_URL) \
		--etherscan-api-key $(INITIASCAN_API_KEY)

deploy-dry:
	forge script script/Deploy.s.sol --rpc-url $(RPC_URL)

# ── Clean ─────────────────────────────────────────────────────────────────────
clean:
	forge clean
	rm -rf lcov.info coverage-report
