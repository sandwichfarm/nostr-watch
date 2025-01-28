<script lang="ts">
import { randomLoadingMessage } from '$utils/ux';
</script>

<div class="flex flex-col text-center items-center justify-center h-[600px]">
    <!-- Adjusted layout for spinner and text -->
    <div class="flex items-center space-x-2">
        <!-- Spinner -->
        <svg class="relative top-2 mb-4 w-6 h-6 animate-spin text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <!-- Text -->
        <span class="text-3xl">please wait</span>
    </div>

    <!-- Random Loading Message -->
    <span class="opacity-50 text-lg text-center italic max-w-[500px]">{randomLoadingMessage()}</span>
</div>