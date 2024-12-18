<script lang="ts">
    import { onMount } from "svelte";
    import { writable, type Writable } from "svelte/store";
    import { Auditor } from "@nostrwatch/auditor";

    // Assume pauseLiveSync is imported from a utility module
    import { pauseLiveSync } from '$lib/utils/lifecycle'; // Update the path as necessary

    // Props passed to the component
    export let relayUrl: string;
    export let nip11: any;

    // Interfaces to define the structure of suites and tests
    interface TestResult {
        suiteKey: string;
        testKey: string;
        pass: boolean;
        passrate: number;
        passed: any[];
        filters: any[];
        skipped: any[];
        failed: any[];
        errors: any[];
        status: 'running' | 'finished';
    }

    interface SuiteResult {
        suiteKey: string;
        pass: boolean;
        reason: string;
        tests: TestResult[];
        status: 'running' | 'finished';
    }

    // Writable store to hold audit results as a list of suites
    const auditResults: Writable<SuiteResult[]> = writable([]);

    // Handler for when a suite starts
    const onSuiteStart = (suiteKey: string) => {
        auditResults.update(suites => {
            // Avoid adding duplicate suites
            if (!suites.find(s => s.suiteKey === suiteKey)) {
                return [...suites, {
                    suiteKey,
                    pass: false,
                    reason: '',
                    tests: [],
                    status: 'running'
                }];
            }
            return suites;
        });
        console.log(`Suite Start: ${suiteKey}`);
    };

    // Handler for when a suite finishes
    const onSuiteFinish = (suiteKey: string, result: any) => {
        auditResults.update(suites => {
            const suite = suites.find(s => s.suiteKey === suiteKey);
            if (suite) {
                suite.pass = result.pass;
                suite.reason = result.reason;
                suite.status = 'finished';
            }
            return suites;
        });
        console.log(`Suite Finish: ${suiteKey}`, result);
    };

    // Handler for when a test within a suite starts
    const onSuiteTestStart = (suiteKey: string, testKey: string | undefined) => {
        if (!testKey) {
            console.warn(`Suite Test Start emitted with undefined testKey in Suite: ${suiteKey}`);
            return;
        }

        auditResults.update(suites => {
            const suite = suites.find(s => s.suiteKey === suiteKey);
            if (suite) {
                // Avoid adding duplicate tests
                if (!suite.tests.find(t => t.testKey === testKey)) {
                    suite.tests.push({
                        suiteKey,
                        testKey,
                        pass: false,
                        passrate: 0,
                        passed: [],
                        filters: [],
                        skipped: [],
                        failed: [],
                        errors: [],
                        status: 'running'
                    });
                }
            }
            return suites;
        });
        console.log(`Suite Test Start: ${testKey} in Suite: ${suiteKey}`);
    };

    // Handler for when a test within a suite finishes
    const onSuiteTestFinish = (suiteKey: string, testResult: any) => {
        const { testKey } = testResult;
        if (!testKey) {
            console.warn(`Suite Test Finish emitted with undefined testKey in Suite: ${suiteKey}`);
            return;
        }

        auditResults.update(suites => {
            const suite = suites.find(s => s.suiteKey === suiteKey);
            if (suite) {
                const test = suite.tests.find(t => t.testKey === testKey);
                if (test) {
                    // Update existing test
                    test.pass = testResult.pass;
                    test.passrate = testResult.passrate;
                    test.passed = testResult.passed;
                    test.filters = testResult.filters;
                    test.skipped = testResult.skipped;
                    test.failed = testResult.failed;
                    test.errors = testResult.errors;
                    test.status = 'finished';
                } else {
                    // If test was not started properly, add it now
                    suite.tests.push({
                        suiteKey,
                        testKey,
                        pass: testResult.pass,
                        passrate: testResult.passrate,
                        passed: testResult.passed,
                        filters: testResult.filters,
                        skipped: testResult.skipped,
                        failed: testResult.failed,
                        errors: testResult.errors,
                        status: 'finished'
                    });
                }
            }
            return suites;
        });
        console.log(`Suite Test Finish: ${testKey} in Suite: ${suiteKey}`, testResult);
    };

    onMount(async () => {
        const resumer = await pauseLiveSync();

        console.log('Starting relay audits...');
        
        const audit = new Auditor();

        if (nip11 && nip11.supportedNips) {
            audit.applySupportedNips(nip11.supportedNips);
        } else {
            console.warn('No nip11 provided or supportedNips missing; skipping supported NIPs application.');
        }

        // Register event listeners
        audit.on('auditor.suite:start', (suiteKey: string) => onSuiteStart(suiteKey));
        audit.on('auditor.suite:finish', (suiteKey: string, result: any) => onSuiteFinish(suiteKey, result));
        audit.on('auditor.suite.test:start', (suiteKey: string, testKey: string | undefined) => onSuiteTestStart(suiteKey, testKey));
        audit.on('auditor.suite.test:finish', (suiteKey: string, testResult: any) => onSuiteTestFinish(suiteKey, testResult));

        // Start the audit process
        await audit.test(relayUrl).catch(err => {
            console.error('Audit failed:', err);
        });

        await resumer();
    });
</script>

<div class="p-6 bg-gray-900 min-h-screen text-white">
    <div class="mb-8">
        <h2 class="text-3xl font-bold">
            Auditing Relay: 
            <a href="{relayUrl}" target="_blank" class="text-blue-400 hover:underline">{relayUrl}</a>
        </h2>
        {#if $auditResults.length === 0}
            <p class="text-gray-400 mt-2">No audit results yet.</p>
        {/if}
    </div>

    <div class="space-y-6">
        {#each $auditResults as suite (suite.suiteKey)}
            <div class="bg-gray-800 shadow-lg rounded-lg p-5">
                <div class="flex justify-between items-center">
                    <div class="flex items-center">
                        {#if suite.status === 'running'}
                            <div class="w-5 h-5 border-2 border-t-2 border-gray-400 rounded-full animate-spin mr-3"></div>
                        {/if}
                        <span class="text-xl font-semibold">
                            Suite: {suite.suiteKey}
                        </span>
                    </div>
                    <div>
                        {#if suite.status === 'running'}
                            <span class="text-yellow-400 font-medium">Running...</span>
                        {:else if suite.pass}
                            <span class="text-green-400 font-medium">Passed</span>
                        {:else}
                            <span class="text-red-400 font-medium">Failed</span>
                        {/if}
                    </div>
                </div>
                {#if suite.reason}
                    <div class="mt-2 text-sm text-gray-400">
                        Reason: {suite.reason}
                    </div>
                {/if}

                <div class="mt-4 space-y-4">
                    {#each suite.tests as test (test.testKey)}
                        <div class="bg-gray-700 shadow rounded-lg p-4">
                            <div class="flex justify-between items-center">
                                <div class="flex items-center">
                                    {#if test.status === 'running'}
                                        <div class="w-4 h-4 border-2 border-t-2 border-gray-400 rounded-full animate-spin mr-2"></div>
                                    {/if}
                                    <span class="font-semibold">
                                        {test.testKey}
                                    </span>
                                </div>
                                <div>
                                    {#if test.status === 'running'}
                                        <span class="text-yellow-400 font-medium">Running...</span>
                                    {:else if test.pass}
                                        <span class="text-green-400 font-medium">Passed</span>
                                    {:else}
                                        <span class="text-red-400 font-medium">Failed</span>
                                    {/if}
                                </div>
                            </div>
                            <div class="mt-2">
                                <details class="w-full">
                                    <summary class="cursor-pointer text-sm text-blue-300 hover:underline">
                                        View Details
                                    </summary>
                                    <div class="mt-2 p-4 bg-gray-600 rounded">
                                        <div class="space-y-2">
                                            <!-- Pass Rate -->
                                            <div>
                                                <span class="font-semibold">Pass Rate:</span> {test.passrate * 100}%
                                            </div>

                                            <!-- Passed Assertions -->
                                            {#if test.passed.length > 0}
                                                <div>
                                                    <span class="font-semibold">Passed:</span>
                                                    <ul class="list-disc list-inside">
                                                        {#each test.passed as pass}
                                                            <li>{pass.message || 'Passed assertion'}</li>
                                                        {/each}
                                                    </ul>
                                                </div>
                                            {/if}

                                            <!-- Failed Assertions -->
                                            {#if test.failed.length > 0}
                                                <div>
                                                    <span class="font-semibold">Failed:</span>
                                                    <ul class="list-disc list-inside">
                                                        {#each test.failed as fail}
                                                            <li>
                                                                <span class="font-medium">{fail.code}:</span> {fail.message}
                                                            </li>
                                                        {/each}
                                                    </ul>
                                                </div>
                                            {/if}

                                            <!-- Skipped Assertions -->
                                            {#if test.skipped.length > 0}
                                                <div>
                                                    <span class="font-semibold">Skipped:</span>
                                                    <ul class="list-disc list-inside">
                                                        {#each test.skipped as skip}
                                                            <li>{skip.message || 'Skipped assertion'}</li>
                                                        {/each}
                                                    </ul>
                                                </div>
                                            {/if}

                                            <!-- Filters -->
                                            {#if test.filters.length > 0}
                                                <div>
                                                    <span class="font-semibold">Filters:</span>
                                                    <ul class="list-disc list-inside">
                                                        {#each test.filters as filter, index}
                                                            <li>
                                                                <span class="font-medium">Filter {index + 1}:</span> 
                                                                {#each Object.entries(filter) as [key, value]}
                                                                    <span class="capitalize">{key}: {Array.isArray(value) ? value.join(', ') : value}</span> 
                                                                {/each}
                                                            </li>
                                                        {/each}
                                                    </ul>
                                                </div>
                                            {/if}

                                            <!-- Errors -->
                                            {#if test.errors && test.errors.length > 0}
                                                <div>
                                                    <span class="font-semibold">Errors:</span>
                                                    <ul class="list-disc list-inside">
                                                        {#each test.errors as error}
                                                            {#if error}
                                                                <li>{error.message || 'Error occurred'}</li>
                                                            {/if}
                                                        {/each}
                                                    </ul>
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                </details>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    /* Optional: Customize scrollbar for better aesthetics */
    pre::-webkit-scrollbar {
        width: 8px;
    }

    pre::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
    }

    pre::-webkit-scrollbar-thumb:hover {
        background-color: rgba(255, 255, 255, 0.5);
    }
</style>
