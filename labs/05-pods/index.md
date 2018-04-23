# Kubernetes Pods
In this lab you will be getting familiar with Kubernetes manifests. 

## Manually create deployment

Create an Nginx Pod in the `default` namespace. 
```
kubectl run nginx-pod-lab --image=nginx-alpine --port=80
```

Confirm the Pod was created successfully.
```
kubectl get pods 
```

You should see something like: 
```
NAME READY STATUS RESTARTS AGE nginx-pod-lab-1856640016-mglns 1/1 Running 0 40s
```

To find out more about the Pod and what's running in it run: 
```
kubectl describe pod <pod name> 
```

Pay attention to the containers section 

Cleanup the running nginx deployment 
```
kubectl delete all 
```


## Kubernetes manifest deployment 
Review the following YAML and then create a file called `nginx-lab.yml` with the contents below: 
```
apiVersion: v1
kind: Pod
matadata:
  labels:
    name: nginx-web
  name: nginx-web
spec:
  containers:
  - image:nginx-alpine
    name: nginx-web
    ports:
      - containerPort: 80
        name: http
        protocol: TCP
```

Now deploy it. 
```
kubectl apply -f nginx-lab.yml
```

If there were no errors check to make sure it was deployed successfully.
```
kubectl get pods 
```

Now let's go ahead and clean up the environment 
```
kubectl delete all 
```

## Multi-container deployment
Now we are going to deploy a Pod with multiple containers. 

Review `two-containers.yml` and pay attention to the section where multiple containers are defined. 
```
apiVersion: v1
kind: Pod
metadata:
  name: two-containers
spec: 

  restartPolicy: Never

  volumes:
  - name: shared-data
    emptyDir: {}
  containers:
  - name: nginx-container
    image: nginx
    volumeMounts:
    - name: shared-data
      mountPath: /usr/share/nginx/html

  - name: debian-container
    image: debian
    volumeMounts:
    - name: shared-data
      mountPath: /pod-data
    command: ["/bin/sh"]
    args: ["-c", "echo Hello from the debian container > /pod-data/index.html"]
```

This Pod containers two containers, one is a web server running `nginx` and the other is a fetcher process to populate an HTML file for `nginx` to display. 

Go ahead na deploy it. 
```
kubectl apply -f two-containers.yml
```

Confirm it was deployed
```
kubectl get pods 
```

Now let's go ahead and log in to confirm `nginx` is working as expected. 
```
kubectl exec -it two-containers -c nginx-container -- bash 
```

Now that we are logged in let's install the `ps` binary so we can confirm `nginx` is running. 
```
apt-get update && apt-get install -y procps && ps aux
```

Should see something similar to this.
```
USER root nginx
PID %CPU %MEM VSZ RSS COMMAND
1 0.0 0.1 31876 5280 nginx: master process nginx 5 0.0 0.0 32264 2964 nginx: worker process
```

Now let's go ahead and install curl so we can test it. 
```
apt-get update && apt-get install -y curl 
```

After `curl` is installed load the default web page and confirm it says something like:
```
Hello from the debian container
```

Great, now you are a little more familiar with Kubernetes Pods and how they act. 

# Lab Complete 