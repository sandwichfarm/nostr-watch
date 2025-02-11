const ws = new WebSocket("wss://nostr.mikoshi.de/");

ws.onopen = () => console.log("Connected!");
ws.onmessage = (event) => console.log("Message:", event.data);
ws.onerror = (event) => console.error("WebSocket error:", event);
ws.onclose = () => console.log("Connection closed");