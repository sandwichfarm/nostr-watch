#!/bin/env bash
echo "BUILDING @nostrwatch/utils"
yarn workspace @nostrwatch/utils build 

echo "BUILDING @nostrwatch/nip66"
yarn workspace @nostrwatch/nip66 build

echo "BUILDING @nostrwatch/nip66-wsadapter-nostrtools"
yarn workspace @nostrwatch/nip66-wsadapter-nostrtools build

echo "BUILDING @nostrwatch/nip66-cacheadapter-nostrsqlite"
yarn workspace @nostrwatch/nip66-cacheadapter-nostrsqlite build

echo "BUILDING @nostrwatch/nip66-cacheadapter-nostrredis"
yarn workspace @nostrwatch/gui build