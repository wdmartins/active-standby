# active-standby

This repository provides an example of Kubernetes active/standby deployment solution for HA mission critical applications.

## Prerrequisites

The following applications need to be installed. Besides the versions used to test the project.

- Minikube (1.24.0)
- Redis    (6.2.0)
- Docker   (20.10.8)

## Setup

- Clone or download this repository
- Create container images

```bash
./buildContainers.sh
```

- Start minikube with 4 nodes and docker driver

```bash
minikube start -n 4 --driver=docker
```

- Apply cluster configuration

```bash
pushd k8s;                     \
kubectl apply -f rbac.yaml;    \
kubectl apply -f app.yaml;     \
kubectl apply -f service.yaml; \
kubectl apply -f audit.yaml;   \
popd
```

- Access the web interface

```bash
minikube service app-service
```

## Test fail take over

On the web browser execute `start` application command:

`http://server-address:port/start`

the status is now `running`.

Delete the active pod:

```bash
kubectl get pods --show-labels
kubectl delete pod `<name of the active pod>
```

Wait for the standby pod to take over:

```bash
kubectl get pods --show-labels
```

On the web browser execute `state` application command:

`http://server-address:port/start`

Note the state is kept as `running` but the pod name is different. The standby pod has taken over.

## Update label with kubectl

To see the audit function fixing pod state inconsistencies change the standby pod to active.

```bash
kubectl label pods --overwrite `<standby pod>` mode=active
```

## Access the kubernetes dashboard

If you are more confortable using UI start the Minikube dashboard:

```bash
minikube dashboard
```
