#!/bin/sh
docker build --pull --rm -f "app/docker/Dockerfile" -t wdmartins/activestandby:latest .
