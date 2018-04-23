# Minikube for Mac
Minikube is an all-in-one Kubernetes cluster which runs on a local machine and can be used for developing and testing. 
The following lab will provide steps for installing Minikube on MacOS

## Install hyperkit
Minikube requires a hypervisor and the recommended minimal one for MacOS is `hyperkit`

To install it we are going to curl the latest binary, give it execute permissions and move it into a directory that is in our `$PATH`.
```
curl -LO https://storage.googleapis.com/minikube/releases/latest/docker-machine-driver-hyperkit \
&& chmod +x docker-machine-driver-hyperkit \
&& sudo mv docker-machine-driver-hyperkit /usr/local/bin/ \
&& sudo chown root:wheel /usr/local/bin/docker-machine-driver-hyperkit \
&& sudo chmod u+s /usr/local/bin/docker-machine-driver-hyperkit
```

## Install kubectl
To interact with our Minikube Kubernetes cluster we need to have the `kubectl` client binary installed. 

```
curl -Lo kubectl https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/darwin/amd64/kubectl && chmod +x kubectl
sudo mv kubectl /usr/local/bin/
```

Now that we've installed `kubectl` let's go ahead and confirm it is working as expect. 
```
kubectl version --client
```
You should see something like: 
```
Client Version: version.Info{Major:"1", Minor:"9", GitVersion:"v1.9.3", GitCommit:"d2835416544f298c919e2ead3be3d0864b52323b", GitTreeState:"clean", BuildDate:"2018-02-07T12:22:21Z", GoVersion:"go1.9.2", Compiler:"gc", Platform:"darwin/amd64"}
```

## Install Minikube
Great! Now all the dependencies are installed let's go ahead and install Minikube 
```
curl -Lo minikube https://storage.googleapis.com/minikube/releases/latest/minikube-darwin-amd64 && chmod +x minikube
sudo mv minikube /usr/local/bin/
```

## Test everything 

Let's start by making sure Minikube starts with the hyperkit driver. 
```
minikube start --vm-driver=hyperkit --memory=4096
```

If everything is installed correctly you should see the following: 
```
Starting local Kubernetes v1.10.0 cluster...
Starting VM...
Getting VM IP address...
Moving files into cluster...
Setting up certs...
Connecting to cluster...
Setting up kubeconfig...
Starting cluster components...
Kubectl is now configured to use the cluster.
Loading cached images from config file.
```

At this point let's go ahead and test out a demo Pod on our Minikube server. 
```
kubectl run hello-minikube --image=gcr.io/google_containers/echoserver:1.4 --port=8080
```

You will see the deployment was successful. 
```
deployment "hello-minikube" created
```


Now we need to expose the newly created service so we can access it from our local machine.
```
kubectl expose deployment hello-minikube --type=NodePort
```

Check and make sure the `hello-minikube` Pod is running 
```
kubectl get pods
```

```
NAME                                READY     STATUS    RESTARTS   AGE
hello-minikube-c8b6b4fdc-4vjvf      1/1       Running   0          1m
```

Finally let's curl the service and make sure we can access it. 
```
curl $(minikube service hello-minikube --url)
```

You should get back some basic info
```
CLIENT VALUES:
client_address=172.17.0.1
command=GET
real path=/
query=nil
request_version=1.1
request_uri=http://192.168.64.4:8080/

SERVER VALUES:
server_version=nginx: 1.10.0 - lua: 10001

HEADERS RECEIVED:
accept=*/*
content-type=application/json
host=192.168.64.4:31960
user-agent=curl/7.54.0
BODY:
-no body in request-
```

If this was all successful than you now have a working Kubernetes cluster running! 

# Lab Complete 