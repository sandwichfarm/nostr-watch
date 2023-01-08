#!/bin/bash
yarn && yarn build
yarn global add yaml2json
yaml2json relays.yaml > dist/relays.json
