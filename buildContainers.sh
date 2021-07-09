#!/bin/sh
docker build --pull --rm -f "app/docker/Dockerfile" -t wdmartins/activestandby:latest .
docker push wdmartins/activestandby:latest
docker build --pull --rm -f "audit/docker/Dockerfile" -t wdmartins/activestandbyaudit:latest .
docker push wdmartins/activestandbyaudit:latest
