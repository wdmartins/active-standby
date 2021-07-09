# active-standby

## Prerrequisites

- Minikube
- Redis
- Docker

## Setup

- Clone or download this project
- Start minikube
- minikube -n 3
- kubectl apply -f k8s/rbac.yaml
- kubectl apply -f app.yaml
- kubectl apply -f service.yaml
- minikube service app-service

## Update label with kubectl

kubectl label pods --overwrite app-deployment-7dc7cdbd65-dvvlz mode=active
