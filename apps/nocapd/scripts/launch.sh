#!/bin/bash

cd $1
docker load < image.tar
if [ $? -ne 0 ]; then
    echo "Command failed"
    exit 1
fi
docker compose stop
docker compose up -d
if [ $? -ne 0 ]; then
    echo "Command failed"
    exit 1
fi

# Cleanup local tar file
rm image.tar