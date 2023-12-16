#!/bin/bash

# Proxy settings
# proxy_address="184.170.248.5"  # Replace with your proxy IP
# proxy_port="4145"              # Replace with your proxy port
proxy_address="127.0.0.1"  # Replace with your proxy IP
proxy_port="9050"

LOGFILE="./tor.log"

file_path="websockets" # Replace with the path to your file

echo "" > $LOGFILE

# Function to extract address and port
extract_address_port_protocol() {
    local full_address=$1
    local address port

    # Remove the trailing slash from the address
    address=$(echo $full_address | sed -e 's/\/$//')

    # Check if a port is specified in the URL
    if [[ $address =~ :([0-9]+)$ ]]; then
        # Extract port from the address
        port=${BASH_REMATCH[1]}
        # Remove the port from the address
        address=${address%:$port}
    else
        # Set default port based on the protocol
        if [[ $address == *"wss://"* ]]; then
            port=443
        else
            port=80
        fi
    fi

    echo "$address $port"
}

if [[ ! -f $file_path ]]; then
    echo "File not found: $file_path"
    exit 1
fi

# Loop through each onion address in the file
# Loop through each onion address in the file
while IFS= read -r full_onion || [[ -n "$full_onion" ]]; do
    # Extract address and port
    read onion_url onion_port <<< $(extract_address_port_protocol "$full_onion")
    echo "Attempting to connect to $onion_url on port $onion_port"

    # Use websocat with timeout to attempt the connection and log the result
    timeout 30 websocat --socks5 127.0.0.1:9050 -t "$onion_url" 2>&1 | tee -a ./websocket.log; echo "Connection attempt finished."

    # Brief pause to allow for connection stabilization and to avoid rapid reconnection attempts
    sleep 5
done < "$file_path"

# while IFS= read -r full_onion; do
#     # Extract address and port
#     read onion_url onion_port <<< $(extract_address_port_protocol "$full_onion")
#     echo "Attempting to connect to $onion_url on port $onion_port"

#     # Use websocat with timeout to attempt the connection
#     timeout 30 websocat --socks5 127.0.0.1:9050 -t "$onion_url" || true
#     exit_status=$?

#     if [ $exit_status -eq 0 ]; then
#         echo "$(date) - Successfully opened WebSocket connection to $onion_url" >> $LOGFILE
#     else
#         echo "$(date) - Failed to open WebSocket connection to $onion_url with exit status $exit_status" >> $LOGFILE
#     fi

#     # Brief pause to allow for connection stabilization and to avoid rapid reconnection attempts
#     sleep 5
# done < "$file_path"

echo "All connections attempted. Check ./tor.log for details."