class TabStateDetector {
    constructor(timeout = 3000) {
        this.timeout = timeout;
        this.isTabActive = true;
        this.timeoutId = null;
        this.abortController = new AbortController();
        this.signal = this.abortController.signal;

        this.onTabActive = () => {};
        this.onTabInactive = () => {};
    }

    // Method to start the detection
    start() {
        document.addEventListener("visibilitychange", this.handleVisibilityChange.bind(this), {
            signal: this.signal,
        });
        console.log("Tab state detection started.");
    }

    // Method to stop the detection
    stop() {
        this.abort();
        console.log("Tab state detection stopped.");
    }

    // Handles visibility changes
    handleVisibilityChange() {
        if (document.visibilityState === "hidden") {
            if (this.timeoutId) clearTimeout(this.timeoutId);
            this.timeoutId = setTimeout(() => {
                if (this.isTabActive) {
                    this.isTabActive = false;
                    console.log("Tab is now considered inactive.");
                    this.onTabInactive();
                }
            }, this.timeout);
        } else if (document.visibilityState === "visible") {
            if (this.timeoutId) clearTimeout(this.timeoutId);
            if (!this.isTabActive) {
                this.isTabActive = true;
                console.log("Tab is active.");
                this.onTabActive();
            }
        }
    }

    // Method to assign a handler for when the tab becomes active
    setOnTabActive(handler) {
        if (typeof handler === "function") {
            this.onTabActive = handler;
        } else {
            console.error("onTabActive handler must be a function.");
        }
    }

    // Method to assign a handler for when the tab becomes inactive
    setOnTabInactive(handler) {
        if (typeof handler === "function") {
            this.onTabInactive = handler;
        } else {
            console.error("onTabInactive handler must be a function.");
        }
    }

    // Aborts all detection and clears listeners
    abort() {
        this.abortController.abort();
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        console.log("Tab state detection aborted.");
    }
}
