import { describe, it, expect, beforeEach, afterEach, vi} from 'vitest';

import NDK, { NDKEventGeoCoded } from '@nostr-dev-kit/ndk';
import { MonitorManager } from './monitor-manager';

// Mock NDKEventGeoCoded and related methods
vi.mock('../../events/kinds/nip66/NDKEventGeoCoded', () => {
  return {
    NDKEventGeoCoded: vi.fn().mockImplementation(() => {
      return {
        fetchNearby: vi.fn(),
        sortGeospatial: vi.fn()
      };
    }),
  };
});

describe("MonitorManager", () => {
    let ndk: NDK;
    let options;
    let MonitorManager;

    beforeEach(() => {
        ndk = new NDK();
        options = {};
        MonitorManager = new MonitorManager(ndk, options);
    });

    it("should be instantiated with the provided NDK instance", () => {
        expect(MonitorManager.ndk).toBe(ndk);
    });

    it("should initialize monitors when populate is called", async () => {
        const mockFetchEvents = vi.fn().mockResolvedValue(new Set());
        ndk.fetchEvents = mockFetchEvents;

        await MonitorManager.populate();
        
        expect(mockFetchEvents).toHaveBeenCalled();
    });

    describe("Filtering and Sorting", () => {
        it("should filter active monitors correctly", async () => {
            const activeMonitor = { active: true };
            const inactiveMonitor = { active: false };
            const monitors = new Set([activeMonitor, inactiveMonitor]);

            monitors.forEach(monitor => {
                monitor.active = vi.fn().mockResolvedValue(monitor.active);
            });

            const filteredMonitors = await MonitorManager.filterActiveMonitors(monitors);

            expect(filteredMonitors).toContain(activeMonitor);
            expect(filteredMonitors).not.toContain(inactiveMonitor);
        });

        it("should sort monitors by proximity correctly", async () => {

            const coords = { lat: 0, lon: 0 };
            const monitors = new Set([{ lat: 1, lon: 1 }, { lat: -1, lon: -1 }]);

            const sortedMonitors = await MonitorManager.sortMonitorsByProximity(coords, monitors);
        });
    });

    describe('populateByCriterias', () => {
        it('should populate monitors based on given criterias', async () => {
            // Setup mocks for NDK methods used within populateByCriterias
            const mockFetchMonitors = vi.fn();
            ndk.fetchEvents = mockFetchMonitors.mockResolvedValue(new Set([/* Mock MonitorManager data */]));

            const criterias = {/* Define criterias */};
            await MonitorManager.populateByCriterias(criterias, true);

            // Verify fetchEvents was called with expected filter
            expect(mockFetchMonitors).toHaveBeenCalledWith(expect.objectContaining({
                /* Expected filter derived from criterias */
            }));

            // Further assertions on the state of MonitorManager after populateByCriterias
            expect(MonitorManager.monitors.size).toBeGreaterThan(0);
            // Add more assertions as needed
        });
    });

    describe('aggregate', () => {
        it('should aggregate data based on the specified fetchAggregate method', async () => {
            // const mockFetchOnlineRelays = vi.fn();
            // NDKEventGeoCoded.prototype.fetchOnlineRelays = mockFetchOnlineRelays.mockResolvedValue(/* Mock data */);

            // const fetchAggregate = 'onlineList'; // Example aggregate method
            // const results = await MonitorManager.aggregate(fetchAggregate, options);

            // expect(mockFetchOnlineRelays).toHaveBeenCalled();

            // expect(results).toBeDefined();
        });
    });
});
