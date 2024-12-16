#!/bin/bash
echo "BUILDING @nostrwatch/utils"
yarn workspace @nostrwatch/utils build 

echo "BUILDING @nostrwatch/logger"
yarn workspace @nostrwatch/logger build 

echo "BUILDING @nostrwatch/nocap"
yarn workspace @nostrwatch/nocap build

echo "BUILDING @nostrwatch/nocap-websocket-adapter-default"
yarn workspace @nostrwatch/nocap-websocket-adapter-default build

echo "BUILDING @nostrwatch/nip66"
yarn workspace @nostrwatch/nip66 build

echo "BUILDING @nostrwatch/nip66-wsadapter-nostrtools"
yarn workspace @nostrwatch/nip66-wsadapter-nostrtools build

echo "BUILDING @nostrwatch/nip66-cacheadapter-nostrsqlite"
yarn workspace @nostrwatch/nip66-cacheadapter-nostrsqlite build

echo "BUILDING @nostrwatch/gui"
yarn workspace @nostrwatch/gui build