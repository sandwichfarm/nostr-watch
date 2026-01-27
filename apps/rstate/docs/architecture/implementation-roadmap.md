# Implementation Roadmap: Compact-First Endpoints

## Quick Reference

**Goal:** Implement dual-endpoint pattern with compact responses as default

**Timeline:** 4-6 weeks

**Team Size:** 2-3 developers

---

## Phase 1: Foundation (Week 1-2)

### Week 1: Core Types & Transformation

**Objective:** Create type definitions and transformation logic

**Tasks:**

1. **Create Compact Schema Types** (2 days)
   - [ ] Define `CompactRelayState` interface in `src/types/compact-schema.ts`
   - [ ] Add compact variants for all response types
   - [ ] Document field mappings (verbose → compact)
   - [ ] Export TypeScript types

   ```typescript
   // src/types/compact-schema.ts
   export interface CompactRelayState { /* ... */ }
   export interface CompactListResponse { /* ... */ }
   export interface CompactSearchResponse { /* ... */ }
   ```

2. **Implement Transformation Layer** (3 days)
   - [ ] Create `src/utils/transform.ts`
   - [ ] Implement `toCompact(state: RelayState): CompactRelayState`
   - [ ] Implement `toCompactArray(states: RelayState[]): CompactRelayState[]`
   - [ ] Handle edge cases (null, undefined, missing fields)
   - [ ] Add JSDoc comments

   ```typescript
   // src/utils/transform.ts
   export function toCompact(state: RelayState): CompactRelayState { /* ... */ }
   export function toCompactArray(states: RelayState[]): CompactRelayState[] { /* ... */ }
   ```

3. **Write Unit Tests** (2 days)
   - [ ] Test transformation correctness
   - [ ] Test edge cases (empty, null, partial data)
   - [ ] Verify no data loss in transformations
   - [ ] Measure size reduction (expect 60-70%)
   - [ ] Performance benchmarks (<10ms overhead)

   ```typescript
   // test/utils/transform.test.ts
   describe('toCompact', () => {
     it('should reduce size by 60-70%', () => { /* ... */ })
     it('should preserve all critical data', () => { /* ... */ })
   })
   ```

**Deliverables:**
- ✅ `src/types/compact-schema.ts` with full type definitions
- ✅ `src/utils/transform.ts` with transformation functions
- ✅ `test/utils/transform.test.ts` with >90% coverage

---

### Week 2: Routing Infrastructure

**Objective:** Build dual-route pattern infrastructure

**Tasks:**

1. **Create Dual-Route Helper** (2 days)
   - [ ] Create `src/rest/dual-route.ts`
   - [ ] Implement `registerDualRoute()` function
   - [ ] Handle schema selection (compact vs. detailed)
   - [ ] Support both GET and POST methods
   - [ ] Add TypeScript types for route configs

   ```typescript
   // src/rest/dual-route.ts
   export function registerDualRoute(app: FastifyInstance, config: DualRouteConfig) {
     // Register base (compact) endpoint
     // Register /detailed endpoint
   }
   ```

2. **Create JSON Schemas** (2 days)
   - [ ] Create `schemas/compact/relay-state-compact.json`
   - [ ] Create compact variants for all response types
   - [ ] Update `src/rest/schemas.ts` to load compact schemas
   - [ ] Validate schemas with test data

   ```bash
   schemas/compact/
     ├── relay-state-compact.json
     ├── relays-list-compact.json
     ├── relays-search-compact.json
     └── ... (12 more files)
   ```

3. **Implement Validation Middleware** (1 day)
   - [ ] Create `src/rest/validation.ts`
   - [ ] Add `validateResponse()` middleware
   - [ ] Configure Ajv validators
   - [ ] Add error handling for validation failures

   ```typescript
   // src/rest/validation.ts
   export function validateResponse(schema: 'compact' | 'detailed') { /* ... */ }
   ```

**Deliverables:**
- ✅ `src/rest/dual-route.ts` with registration helper
- ✅ `schemas/compact/*.json` with 15+ schema files
- ✅ `src/rest/validation.ts` with middleware

---

## Phase 2: Endpoint Migration (Week 3-4)

### Week 3: Core Relay Endpoints

**Objective:** Migrate primary relay endpoints to dual pattern

**Tasks:**

1. **Migrate List & Single Relay Endpoints** (2 days)
   - [ ] Update `GET /relays` → dual pattern
   - [ ] Update `GET /relays/state` → dual pattern
   - [ ] Keep `?compact=` parameter (deprecated, with warnings)
   - [ ] Add OpenAPI/Swagger docs

   ```typescript
   // src/rest/routes/relays.ts
   registerDualRoute(app, {
     basePath: '/relays',
     compact: { handler: listCompactHandler },
     detailed: { handler: listDetailedHandler }
   })
   ```

2. **Migrate Search & Geographic Endpoints** (2 days)
   - [ ] Update `POST /relays/search` → dual pattern
   - [ ] Update `GET /relays/nearby` → dual pattern
   - [ ] Update `GET /relays/bbox` → dual pattern
   - [ ] Test query parameter preservation

3. **Migrate Grouping Endpoints** (1 day)
   - [ ] Update `GET /relays/by/label` → dual pattern
   - [ ] Update `GET /relays/by/software` → dual pattern
   - [ ] Update `GET /relays/by/network` → dual pattern
   - [ ] Update `GET /relays/by/nip` → dual pattern
   - [ ] Update `GET /relays/by/country` → dual pattern

**Deliverables:**
- ✅ 13 endpoints migrated to dual pattern
- ✅ All tests passing
- ✅ OpenAPI docs updated

---

### Week 4: Comparison & Availability Endpoints

**Objective:** Complete endpoint migration

**Tasks:**

1. **Migrate Comparison Endpoint** (1 day)
   - [ ] Update `POST /relays/compare` → dual pattern
   - [ ] Ensure 402.markets payment integration works

2. **Migrate Availability Endpoints** (2 days)
   - [ ] Update `POST /relays/online` → dual pattern
   - [ ] Update `POST /relays/offline` → dual pattern
   - [ ] Update `POST /relays/dead` → dual pattern
   - [ ] Test filter combinations

3. **Integration Testing** (2 days)
   - [ ] Create `test/rest/compact-endpoints.test.ts`
   - [ ] Create `test/rest/detailed-endpoints.test.ts`
   - [ ] Test all 17 endpoint pairs
   - [ ] Verify response format consistency
   - [ ] Test error responses

**Deliverables:**
- ✅ All 17 endpoints migrated
- ✅ Comprehensive integration test suite
- ✅ Zero regressions from existing functionality

---

## Phase 3: ContextVM & 402.markets (Week 5)

### ContextVM Tool Updates

**Objective:** Update ContextVM tools for dual-format support

**Tasks:**

1. **Register Compact Tools** (1 day)
   - [ ] Update `src/core/cvm-tools.ts`
   - [ ] Make compact format default for all tools
   - [ ] Add `_detailed` variants for explicit verbose access
   - [ ] Update tool descriptions

   ```typescript
   // Compact (default)
   cvm.registerTool({ name: 'relay_list', format: 'compact' })

   // Detailed (explicit)
   cvm.registerTool({ name: 'relay_list_detailed', format: 'detailed' })
   ```

2. **Test CVM Integration** (1 day)
   - [ ] Test tool invocations return compact format
   - [ ] Test `_detailed` tools return full format
   - [ ] Verify tool descriptions are clear

**Deliverables:**
- ✅ CVM tools updated for dual-format support
- ✅ All CVM tests passing

---

### 402.markets Payment Integration

**Objective:** Integrate with L402 and Cashu payment flows

**Tasks:**

1. **Update Payment Handlers** (2 days)
   - [ ] Create `detailedEndpointPaymentHandler()` in `src/rest/payments.ts`
   - [ ] Configure different pricing for compact vs. detailed
   - [ ] Add L402 challenge generation for `/detailed` routes
   - [ ] Add Cashu challenge generation
   - [ ] Test payment verification flow

   ```typescript
   // Compact: 10 msats (or free)
   // Detailed: 25 msats (always paid)
   ```

2. **Test Payment Flows** (1 day)
   - [ ] Test 402 response for unauthenticated `/detailed` requests
   - [ ] Test L402 payment verification
   - [ ] Test Cashu token verification
   - [ ] Test tiered pricing logic

**Deliverables:**
- ✅ Payment integration complete
- ✅ Pricing tiers configured
- ✅ L402 & Cashu flows tested

---

## Phase 4: Documentation & Rollout (Week 6)

### Documentation

**Objective:** Comprehensive API and migration documentation

**Tasks:**

1. **API Documentation** (2 days)
   - [ ] Create `docs/api/compact-format.md`
     - Explain compact schema
     - Show field mappings (verbose → compact)
     - Provide JSON examples
   - [ ] Create `docs/api/migration-guide.md`
     - Step-by-step client migration
     - Code examples (before/after)
     - Deprecation timeline
   - [ ] Update `docs/api/endpoints.md`
     - Document all `/detailed` endpoints
     - Add response size comparisons
     - Show pricing differences

2. **Developer Guide** (1 day)
   - [ ] Create `docs/api/monetization.md`
     - Explain 402.markets integration
     - Show L402 authentication flow
     - Show Cashu token flow
     - Pricing tier details

**Deliverables:**
- ✅ 4 comprehensive documentation files
- ✅ Client migration examples
- ✅ Monetization guide

---

### Gradual Rollout

**Objective:** Safe, monitored rollout with rollback capability

**Tasks:**

1. **Configure Feature Flags** (1 day)
   - [ ] Add `enableCompactDefault` flag (default: `false`)
   - [ ] Add `enableDetailedEndpoints` flag (default: `true`)
   - [ ] Add `deprecateCompactParam` flag (default: `false`)
   - [ ] Update `src/config.ts`

   ```typescript
   interface RestConfig {
     enableCompactDefault: boolean
     enableDetailedEndpoints: boolean
     deprecateCompactParam: boolean
   }
   ```

2. **Set Up Monitoring** (1 day)
   - [ ] Add metrics for endpoint usage (compact vs. detailed)
   - [ ] Track response sizes
   - [ ] Track transformation errors
   - [ ] Set up alerts for error spikes

3. **Rollout Phases** (1 day per phase)
   - [ ] **Phase 1:** Deploy with `/detailed` endpoints, keep compact opt-in
     - `enableDetailedEndpoints = true`
     - `enableCompactDefault = false`
   - [ ] **Phase 2:** Make compact default, deprecate `?compact=` param
     - `enableCompactDefault = true`
     - `deprecateCompactParam = true`
   - [ ] **Phase 3:** Remove `?compact=` parameter support
     - Remove deprecated code

**Deliverables:**
- ✅ Feature flags configured
- ✅ Monitoring dashboards created
- ✅ Rollout successfully completed

---

## Success Criteria

### Performance Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| **Response size reduction** | 60-70% | Compare JSON byte sizes |
| **Transformation overhead** | <10ms per request | Middleware timing |
| **Error rate** | <0.1% | Error logs & alerts |
| **Throughput increase** | 2x more requests | Load testing |

### Adoption Metrics

| Metric | Target | Timeline |
|--------|--------|----------|
| **Client migration** | 80% using compact | 3 months |
| **`/detailed` usage** | <20% of requests | Steady state |
| **Payment success rate** | >95% | Ongoing |

### Business Metrics

| Metric | Target | Impact |
|--------|--------|--------|
| **Egress cost reduction** | 50-60% | $X/month savings |
| **402.markets revenue** | $Y/month | New revenue stream |
| **User satisfaction** | Positive feedback | Survey results |

---

## Risk Mitigation

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Transformation bugs** | Medium | High | Extensive unit tests, gradual rollout |
| **Performance regression** | Low | Medium | Benchmarks, monitoring |
| **Client breakage** | Low | High | Backward compat, deprecation warnings |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **User resistance** | Medium | Medium | Clear docs, migration guide |
| **Payment failures** | Low | High | Robust error handling, fallbacks |
| **Revenue loss** | Low | Medium | Tiered pricing, free compact tier |

---

## Rollback Plan

### Emergency Rollback Procedure

**Trigger:** >1% error rate OR critical client feedback

**Steps:**
1. Set `DISABLE_COMPACT_ENDPOINTS=true` environment variable
2. Restart services (zero-downtime rolling restart)
3. Monitor error rates (should drop to baseline)
4. Investigate root cause
5. Fix issues in development environment
6. Re-deploy with fixes

**Rollback Code:**

```typescript
// In src/rest/routes/relays.ts
if (process.env.DISABLE_COMPACT_ENDPOINTS === 'true') {
  // Skip dual-route registration
  // Use legacy route registration
  return registerLegacyRoutes(app, context)
}
```

---

## Team Assignments

### Core Team

| Role | Responsibilities | Time Commitment |
|------|------------------|-----------------|
| **Backend Lead** | Type definitions, transformation logic, route migration | Full-time, 6 weeks |
| **API Developer** | Schema creation, validation, testing | Full-time, 4 weeks |
| **DevOps Engineer** | Monitoring, rollout, rollback procedures | Part-time, 2 weeks |
| **Technical Writer** | Documentation, migration guide | Part-time, 1 week |

### Support Team

| Role | Responsibilities | Time Commitment |
|------|------------------|-----------------|
| **QA Engineer** | Integration testing, load testing | Full-time, 2 weeks |
| **Product Manager** | Pricing strategy, user communication | Part-time, ongoing |

---

## Dependencies

### Internal Dependencies

- [x] Existing `RelayState` interface stable
- [x] `compactRelayState()` utility function exists
- [x] REST server using Fastify
- [x] 402.markets payment infrastructure ready

### External Dependencies

- [ ] Client libraries updated (community)
- [ ] Documentation site deployed
- [ ] Payment provider (402.markets) configured

---

## Post-Implementation

### Ongoing Maintenance

**Week 7+:**
- [ ] Monitor metrics weekly
- [ ] Respond to client feedback
- [ ] Optimize transformation performance
- [ ] Update documentation based on usage patterns

**Month 2-3:**
- [ ] Evaluate pricing effectiveness
- [ ] Consider additional compact formats (e.g., MessagePack, Protobuf)
- [ ] Implement caching strategies for compact responses
- [ ] Expand to other endpoint groups (monitors, metrics)

### Future Enhancements

**Potential improvements:**
1. **Binary formats:** Protobuf or MessagePack for even smaller payloads
2. **Response compression:** Gzip/Brotli for additional savings
3. **GraphQL integration:** Allow clients to request specific fields
4. **WebSocket subscriptions:** Real-time compact updates
5. **Client SDK:** Auto-transform compact responses in client libraries

---

## Quick Start for Developers

### Getting Started

```bash
# 1. Pull latest code
git checkout main
git pull

# 2. Install dependencies
npm install

# 3. Review architecture
cat docs/architecture/endpoint-design.md

# 4. Start with Phase 1, Week 1, Task 1
# Create compact schema types
code src/types/compact-schema.ts
```

### Development Workflow

```bash
# 1. Create feature branch
git checkout -b feature/compact-endpoints

# 2. Implement task
# ... write code ...

# 3. Run tests
npm run test

# 4. Check types
npm run typecheck

# 5. Commit with conventional commits
git commit -m "feat(rest): add compact schema types"

# 6. Push and create PR
git push origin feature/compact-endpoints
```

### Testing Strategy

```bash
# Unit tests
npm run test:unit -- transform.test.ts

# Integration tests
npm run test:integration -- compact-endpoints.test.ts

# Load tests
npm run test:load -- --endpoint /relays

# Coverage report
npm run test:coverage
```

---

## Conclusion

This roadmap provides a clear, phased approach to implementing the compact-first endpoint architecture. By following this plan, the team can deliver:

✅ **60-70% bandwidth reduction**
✅ **Improved API performance**
✅ **Successful 402.markets integration**
✅ **Zero breaking changes for existing clients**
✅ **Clear migration path and documentation**

**Estimated Effort:** 6 weeks with 2-3 developers

**Expected ROI:** 50-60% cost savings + new revenue stream

---

*For questions or clarifications, refer to the full architectural specification in `endpoint-design.md`*
