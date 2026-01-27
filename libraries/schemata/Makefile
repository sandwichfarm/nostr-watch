# Makefile that converts all *.yaml in nips/ and @ -> dist/,
# rewrites references to absolute paths, then dereferences them.

NIPS_DIR := nips
ALIASES_DIR := @
DIST_DIR := dist

YAMLCONVERT := yaml-convert
REWRITE_SCRIPT := node $(realpath scripts/rewriteRefs.js)
DEREF_SCRIPT := node $(realpath scripts/deref.js)

SCHEMA_YAMLS := $(shell find $(NIPS_DIR) -type f -name "*.yaml")
ALIAS_YAMLS  := $(shell find $(ALIASES_DIR) -type f -name "*.yaml")
ALL_YAMLS    := $(SCHEMA_YAMLS) $(ALIAS_YAMLS)

JSON_SCHEMAS := $(patsubst %.yaml,$(DIST_DIR)/%.json,$(ALL_YAMLS))

all: convert_json rewrite_refs dereference_json

$(DIST_DIR)/%.json: %.yaml
	@echo "Converting $< -> $@"
	@mkdir -p $(dir $@)
	@$(YAMLCONVERT) $< > $@
	@sed -i.bak 's/\.yaml/.json/g' $@ && rm $@.bak

.PHONY: convert_json
convert_json: FORCE $(JSON_SCHEMAS)

.PHONY: rewrite_refs
rewrite_refs: convert_json
	@echo "Rewriting references in dist/..."
	@cd $(DIST_DIR) && \
	for f in $(patsubst $(DIST_DIR)/%,%,$(JSON_SCHEMAS)); do \
		echo " -> rewriting $$f"; \
		$(REWRITE_SCRIPT) $$f $$f; \
	done

.PHONY: dereference_json
dereference_json: rewrite_refs
	@echo "Dereferencing JSON schemas in dist/..."
	@cd $(DIST_DIR) && \
	for f in $(patsubst $(DIST_DIR)/%,%,$(JSON_SCHEMAS)); do \
		echo " -> dereferencing $$f"; \
		$(DEREF_SCRIPT) $$f $$f; \
	done

.PHONY: clean
clean:
	@rm -rf $(DIST_DIR)

.PHONY: FORCE
FORCE:
