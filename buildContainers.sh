#!/bin/sh
docker build --pull --rm -f "app/docker/Dockerfile" -t activestandby:latest .
