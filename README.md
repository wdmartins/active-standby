# active-standby

## Prerrequisites

- Minikube
- Redis
- Docker

## Setup

- Clone or download this project
- Start minikube

```bash
minikube start -n 3
```

- Apply cluster configuration

```bash
pushd k8s;                     \
kubectl apply -f rbac.yaml;    \
kubectl apply -f app.yaml;     \
kubectl apply -f service.yaml; \
kubectl apply -f  audit.yaml;  \
popd
```

- Access the web interface

```bash
minikube service app-service
```

## Update label with kubectl

kubectl label pods --overwrite app-deployment-7dc7cdbd65-dvvlz mode=active
