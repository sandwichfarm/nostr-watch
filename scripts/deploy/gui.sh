#!/bin/env bash
yarn workspace @nostrwatch/nip66 build
yarn workspace @nostrwatch/nip66-cacheadapter-nostrsqlite build
yarn workspace @nostrwatch/nip66-wsadapter-nostrtools build
yarn workspace @nostrwatch/utils build 
yarn workspace @nostrwatch/gui build