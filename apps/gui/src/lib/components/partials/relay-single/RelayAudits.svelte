<script lang="ts">
    import { onMount } from "svelte";
    import { writable, type Writable } from "svelte/store";
    import { Auditor } from "@nostrwatch/auditor";

    // Assume pauseLiveSync is imported from a utility module
    import { pauseLiveSync } from '$lib/utils/lifecycle.js'; // Update the path as necessary
	import type { Note } from "nostr-tools/nip19";

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
        notices: string[][];
        events: Note[];
    }

    interface SuiteResult {
        suiteKey: string;
        pass: boolean;
        reason: string;
        tests: TestResult[];
        samples: Record<string, any[]>; // Dynamic samples data
        status: 'running' | 'finished';
    }

    // Writable store to hold audit results as a list of suites
    const auditResults: Writable<SuiteResult[]> = writable([]);

    // Reactive variable to track expanded sample sets
    let expandedSamples: Record<string, boolean> = {};

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
                    samples: {},
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
                        status: 'running',
                        notices: [],
                        events: []
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
                        status: 'finished',
                        notices: testResult.notices,
                        events: testResult.events
                    });
                }
            }
            return suites;
        });
        console.log(`Suite Test Finish: ${testKey} in Suite: ${suiteKey}`, testResult);
    };

    // Handler for when samples are emitted for a suite
    const onSuiteSamples = (suiteKey: string, samples: Record<string, any[]>) => {
        auditResults.update(suites => {
            const suite = suites.find(s => s.suiteKey === suiteKey);
            if (suite) {
                suite.samples = samples;
            } else {
                // If suite hasn't started yet, add it with samples
                suites.push({
                    suiteKey,
                    pass: false,
                    reason: '',
                    tests: [],
                    samples: samples,
                    status: 'running'
                });
            }
            return suites;
        });
        console.log(`Suite Samples: ${suiteKey}`, samples);
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
        audit.on('auditor.suite:samples', (suiteKey: string, samples: Record<string, any[]>) => onSuiteSamples(suiteKey, samples));

        // Start the audit process
        await audit.test(relayUrl).catch(err => {
            console.error('Audit failed:', err);
        });

        await resumer();
    });

    // Function to toggle the expansion of a sample-set
    function toggleSampleExpansion(suiteKey: string, sampleKey: string) {
        const id = `${suiteKey}:${sampleKey}`;
        expandedSamples = { ...expandedSamples, [id]: !expandedSamples[id] };
    }
</script>

<div class="p-6 min-h-screen text-white">
    <div class="mb-8">
        <h2 class="text-3xl font-bold">
            Running NIP Audit
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

                {#if Object.keys(suite.samples).length > 0}
                    <details class="mt-4 p-4 bg-gray-700 rounded-lg">
                        <summary class="cursor-pointer text-lg font-semibold text-blue-300 hover:underline">
                            Samples Obtained
                        </summary>
                        <div class="mt-2 space-y-3">
                            {#each Object.entries(suite.samples) as [key, value]}
                                <div>
                                    <span class="font-medium capitalize">{key}:</span>
                                    {#if Array.isArray(value)}
                                        {#if value.length === 0}
                                            <span class="text-gray-400">No data available.</span>
                                        {:else if typeof value[0] === 'string'}
                                            <ul class="list-disc list-inside text-sm">
                                                {#each (expandedSamples[`${suite.suiteKey}:${key}`] ? value : value.slice(0,5)) as item}
                                                    <li>{item}</li>
                                                {/each}
                                            </ul>
                                            {#if value.length > 5}
                                                <button class="text-blue-400 text-sm mt-1" on:click={() => toggleSampleExpansion(suite.suiteKey, key)}>
                                                    {expandedSamples[`${suite.suiteKey}:${key}`] ? 'Show less' : 'Show more'}
                                                </button>
                                            {/if}
                                        {:else if typeof value[0] === 'number'}
                                            <span class="text-sm">
                                                {expandedSamples[`${suite.suiteKey}:${key}`] ? value.join(', ') : value.slice(0,5).join(', ')}
                                                {#if value.length > 5}
                                                    <button class="text-blue-400 text-sm ml-2" on:click={() => toggleSampleExpansion(suite.suiteKey, key)}>
                                                        {expandedSamples[`${suite.suiteKey}:${key}`] ? 'Show less' : 'Show more'}
                                                    </button>
                                                {/if}
                                            </span>
                                        {:else}
                                            <span class="text-sm">Unsupported data type.</span>
                                        {/if}
                                    {:else}
                                        <span class="text-sm">Unsupported data type.</span>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </details>
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
                                                <span class="font-semibold">Pass Rate:</span> {Math.round(test.passrate * 100)}%
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
                                                    <pre>{JSON.stringify(test.filters, null, 2)}</pre>
                                                </div>
                                            {/if}

                                             <!-- notices -->
                                             {#if test.notices && test.notices.length > 0}
                                             <div>
                                                 <span class="font-semibold">Notices:</span>
                                                 <ul class="list-disc list-inside">
                                                     {#each test.notices as notice}
                                                         {#if notice}
                                                             <li>[notice[1]]</li>
                                                         {/if}
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
                </div></div>
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

        /* Optional: Smooth transition for details */
        details > summary {
            list-style: none;
        }

        details > summary::-webkit-details-marker {
            display: none;
        }

        /* Button styling */
        button {
            background: none;
            border: none;
            padding: 0;
            font: inherit;
            cursor: pointer;
            color: #3b82f6; /* Tailwind's text-blue-400 */
        }

        button:hover {
            text-decoration: underline;
        }
    </style>
