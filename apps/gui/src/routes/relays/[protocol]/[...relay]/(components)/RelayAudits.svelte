<script lang="ts">
    import { onMount } from "svelte";
    import { writable, type Writable } from "svelte/store";
    import { Auditor } from "@nostrwatch/auditor";
    import * as Tabs from "$lib/components/ui/tabs";


    // Assume pauseLiveSync is imported from a utility module
    import { pauseLiveSync } from '$lib/utils/lifecycle.js'; // Update the path as necessary
    import type { Note } from "nostr-tools/nip19";
	// import Badge from "../../ui/badge/badge.svelte";
	import type { Nip11 } from "@nostrwatch/route66/models";

    import * as Alert from "$lib/components/ui/alert/index.js";
	import Badge from "$ui/badge/badge.svelte";


    // Props passed to the component
    export let relayUrl: string;
    export let nip11: Writable<Nip11 | undefined>;

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
        ////console.log(`Suite Start: ${suiteKey}`);
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
        ////console.log(`Suite Finish: ${suiteKey}`, result);
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
        ////console.log(`Suite Test Start: ${testKey} in Suite: ${suiteKey}`);
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
                    test.notices = testResult.notices
                    test.events = testResult.events
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
        ////console.log(`Suite Test Finish: ${testKey} in Suite: ${suiteKey}`, testResult);
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
        ////console.log(`Suite Samples: ${suiteKey}`, samples);
    };

    onMount(async () => {
        // const resumer = await pauseLiveSync();

        ////console.log('Starting relay audits...');
        
        const audit = new Auditor();

        if ($nip11 && $nip11?.supportedNips) {
            audit.applySupportedNips($nip11.supportedNips);
        } else {
            await audit.detectSupportedNips()
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

        // await resumer();
    });

    // Function to toggle the expansion of a sample-set
    function toggleSampleExpansion(suiteKey: string, sampleKey: string) {
        const id = `${suiteKey}:${sampleKey}`;
        expandedSamples = { ...expandedSamples, [id]: !expandedSamples[id] };
    }
</script>


<div class="p-6 min-h-screen text-white">

    <Alert.Root class="mb-2">
        <Alert.Title>Notice</Alert.Title>
        <Alert.Description>
            The relay audit feature is alpha and very experimental. Presently, `AUTH` relays will return false negatives. Only a few NIPs presently have testing suites.
        </Alert.Description>
    </Alert.Root>

    <div class="mb-8">
        {#if $auditResults.length === 0}
            <p class="text-gray-400 mt-2">No audit results yet.</p>
        {/if}
    </div>

    <div class="space-y-6">
        {#each $auditResults as suite (suite.suiteKey)}
            <div class="bg-black/5 dark:bg-white/10 shadow-lg rounded-lg p-5">
                <div class="flex justify-between items-center">
                    <div class="flex items-center">
                        {#if suite.status === 'running'}
                            <div class="w-4 h-4 border-2 border-t-2 border-gray-400 rounded-sm animate-spin mr-2"></div>
                        {/if}
                        <span class="text-xl font-semibold text-black dark:text-white bg-black/20 dark:bg-white/20">
                            Suite: {suite.suiteKey}
                        </span>
                    </div>
                    {#if suite.status !== 'running'}
                        <!-- Compute metrics -->
                        <div class="flex space-x-4">
                            <span class="text-green-400 font-medium">
                                Pass Rate: 
                                {#if suite.tests.length > 0}
                                    {Math.round((suite.tests.filter(t => t.pass).length / suite.tests.length) * 100)}%
                                {:else}
                                    N/A
                                {/if}
                            </span>
                            <span class="text-green-400 font-medium">
                                Passed: {suite.tests.filter(t => t.pass && t.skipped.length === 0).length}
                            </span>
                            <span class="text-red-400 font-medium">
                                Failed: {suite.tests.filter(t => !t.pass && t.status === 'finished').length}
                            </span>
                            <span class="text-yellow-400 font-medium">
                                Skipped: {suite.tests.filter(t => t.skipped.length > 0).length}
                            </span>
                        </div>
                    {/if}
                </div>
                {#if suite.reason}
                    <div class="mt-2 text-sm text-gray-400">
                        Reason: {suite.reason}
                    </div>
                {/if}

                {#if Object.keys(suite.samples).length > 0}
                    <details class="mt-4 p-4 bg-gray-700 rounded-lg">
                        <summary class="cursor-pointer text-lg font-semibold text-blue-300 hover:underline {Object.values(suite.samples).flat().length > 0? 'text-green-400': 'text-red-400'}">
                            <Badge variant="secondary">{Object.values(suite.samples).flat().length}</Badge>
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
                                    <span class="inline-block mr-2">
                                    {#if test.status === 'running'}
                                        <div class="w-4 h-4 border-2 border-t-2 border-gray-400 rounded-sm animate-spin"></div>
                                    {:else}
                                        
                                        {#if test.pass && test.skipped.length === 0}
                                            <svg class="w-6 h-6 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                                            </svg>
                                        {:else if test.skipped.length > 0}
                                            <svg  class="w-6 h-6 text-orange-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 5.177l8.631 15.823h-17.262l8.631-15.823zm0-4.177l-12 22h24l-12-22zm-1 9h2v6h-2v-6zm1 9.75c-.689 0-1.25-.56-1.25-1.25s.561-1.25 1.25-1.25 1.25.56 1.25 1.25-.561 1.25-1.25 1.25z"/></svg>
                                        {:else}
                                            <svg class="w-4 h-4 text-red-600" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 256 256" xml:space="preserve">
                                                <g style="stroke: none; stroke-width: 0; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: none; fill-rule: nonzero; opacity: 1;" transform="translate(1.4065934065934016 1.4065934065934016) scale(2.81 2.81)" >
                                                    <path d="M 11 90 c -2.815 0 -5.63 -1.074 -7.778 -3.222 c -4.295 -4.296 -4.295 -11.261 0 -15.557 l 68 -68 c 4.297 -4.296 11.26 -4.296 15.557 0 c 4.296 4.296 4.296 11.261 0 15.557 l -68 68 C 16.63 88.926 13.815 90 11 90 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(214,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
                                                    <path d="M 79 90 c -2.815 0 -5.63 -1.074 -7.778 -3.222 l -68 -68 c -4.295 -4.296 -4.295 -11.261 0 -15.557 c 4.296 -4.296 11.261 -4.296 15.557 0 l 68 68 c 4.296 4.296 4.296 11.261 0 15.557 C 84.63 88.926 81.815 90 79 90 z" style="stroke: none; stroke-width: 1; stroke-dasharray: none; stroke-linecap: butt; stroke-linejoin: miter; stroke-miterlimit: 10; fill: rgb(214,0,0); fill-rule: nonzero; opacity: 1;" transform=" matrix(1 0 0 1 0 0) " stroke-linecap="round" />
                                                </g>
                                            </svg>
                                        {/if}
                                    {/if}
                                    </span>
                                    <span class="font-semibold">
                                        {test.testKey}
                                    </span>
                                </div>
                                <div>
                                    {#if test.status === 'running'}
                                        <span class="text-yellow-400 font-medium">Running...</span>
                                    {:else} 
                                        {#if test.skipped.length > 0}
                                            <span class="text-gray-400 font-medium">Skipped</span>
                                        {:else if test.pass}
                                            <span class="text-green-400 font-medium">Passed</span>
                                        {:else}
                                            <span class="text-red-400 font-medium">Failed</span>
                                        {/if}
                                    {/if}
                                </div>
                            </div>
                            <div class="mt-2">
                                <details class="w-full">
                                    <summary class="cursor-pointer text-sm text-blue-300 hover:underline">
                                        View Details
                                    </summary>
                                    <div class="mt-2 p-4 bg-gray-600 rounded">                                        
                                        <Tabs.Root value="parsed">
                                            <Tabs.List>
                                            <Tabs.Trigger value="parsed">Parsed</Tabs.Trigger>
                                            <Tabs.Trigger value="json">JSON</Tabs.Trigger>
                                            </Tabs.List>
                                            <Tabs.Content value="parsed">
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

                                                <!-- Notices -->
                                                {#if test.events && test.events.length > 0}
                                                    <div>
                                                        <span class="font-semibold">{test.events.length} Events Returned:</span>
                                                        <ul class="list-disc list-insid pl-6">
                                                            {#each test.events as note}
                                                               <li class="list-outside list-item">
                                                                ID: {note.id} <br />
                                                                Kind: {note.kind} <br />
                                                                Author: {note.author}
                                                               </li>
                                                            {/each}
                                                        </ul>
                                                    </div>
                                                {/if}

                                                <!-- Notices -->
                                                {#if test.notices && test.notices.length > 0}
                                                    <div>
                                                        <span class="font-semibold">Notices:</span>
                                                        <ul class="list-disc list-inside">
                                                            {#each test.notices as notice}
                                                                {#if notice && notice.length > 1}
                                                                    <li>{notice[1]}</li>
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
                                        
                                            </Tabs.Content>
                                            <Tabs.Content value="json">
                                                <pre>{JSON.stringify(test, null, 4)}</pre>
                                            </Tabs.Content>
                                        </Tabs.Root>
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
