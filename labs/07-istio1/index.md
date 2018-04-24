# Hands-on workshop on Istio (with Kubernetes)

![Istio](media/istio.png)

## Summary
In this lab, you will learn how to install and configure Istio, an open source framework for connecting, securing, and managing microservices, on Google Kubernetes Engine, Google's hosted Kubernetes product. You will also deploy an Istio-enabled multi-service application.


## Introduction <a name="introduction"/>

[Istio](http://istio.io) is an open source framework for connecting, securing, and managing microservices, including services running on Google Kubernetes Engine (GKE). It lets you create a network of deployed services with load balancing, service-to-service authentication, monitoring, and more, without requiring any changes in service code.

You add Istio support to services by deploying a special Envoy sidecar proxy to each of your application&#39;s pods in your environment that intercepts all network communication between microservices, configured and managed using Istio'&#39;'s control plane functionality.

This codelab shows you how to install and configure Istio on Kubernetes Engine, deploy an Istio-enabled multi-service application, and dynamically change request routing.



## Installing Istio <a name="installing-istio"/>

Before we can install Istio we have to setup some permissions. 

Grant cluster admin permissions to the current user. You need these permissions to create the necessary RBAC rules for Istio.

```
    kubectl create clusterrolebinding cluster-admin-binding \
    --clusterrole=cluster-admin \
    --user=admin
```


Now, let&#39;s install Istio. Istio is installed in its own Kubernetes istio-system namespace, and can manage microservices from all other namespaces. The installation includes Istio core components, tools, and samples.

The [Istio release page](https://github.com/istio/istio/releases) offers download artifacts for several OSs. In our case, with CloudShell we&#39;ll be using this command to download and extract the latest release automatically:

```curl -L https://git.io/getLatestIstio | sh -```

The installation directory contains the following:

- Installation .yaml files for Kubernetes in **install/**
- Sample applications in **samples/**
- The istioctl client binary in the **bin/** directory. This tool is used when manually injecting Envoy as a sidecar proxy and for creating routing rules and policies.
- The VERSION configuration file

Change to the istio install directory:

```cd ./istio-* ```

Add the istioctl client to your PATH:

```export PATH=$PWD/bin:$PATH```

Let&#39;s now install Istio&#39;s core components. We will install the Istio Auth components which enable [**mutual TLS authentication**](https://istio.io/docs/concepts/security/mutual-tls.html) between sidecars:

```kubectl apply -f install/kubernetes/istio-auth.yaml```

This creates the istio-system namespace along with the required RBAC permissions, and deploys Istio-Pilot, Istio-Mixer, Istio-Ingress, Istio-Egress, and Istio-CA (Certificate Authority).

## Verifying the installation <a name="verifying-the-installation"/>

First, ensure the following Kubernetes services are deployed: istio-pilot, istio-mixer, istio-ingress, and istio-egress.

Run the command:
```
kubectl get svc -n istio-system
```
OUTPUT:

```
NAME            CLUSTER-IP      EXTERNAL-IP       PORT(S)                       AGE
istio-ingress   10.83.245.171   35.184.245.62     80:32730/TCP,443:30574/TCP    3m
istio-pilot     10.83.251.173   <none>            8080/TCP,8081/TCP             3m
istio-mixer     10.83.244.253   <none>            9091/TCP,9094/TCP,42422/TCP   3m
```

Then make sure that the corresponding Kubernetes pods are deployed and all containers are up and running: istio-pilot-\*, istio-mixer-\*, istio-ingress-\*, istio-ca-\*.

Run the command:
```
kubectl get pods -n istio-system
```
OUTPUT:
```
NAME                                READY     STATUS    RESTARTS   AGE
istio-ca-3657790228-j21b9           1/1       Running   0          3m
istio-ingress-1842462111-j3vcs      1/1       Running   0          3m
istio-pilot-2275554717-93c43        1/1       Running   0          3m
istio-mixer-2104784889-20rm8        2/2       Running   0          3m
```

When all the pods are running, you can proceed.

## Deploying an application <a name="deploying-an-application"/>

Now Istio is installed and verified, you can deploy one of the sample applications provided with the installation — [BookInfo](https://istio.io/docs/guides/bookinfo.html). This is a simple mock bookstore application made up of four services that provide a web product page, book details, reviews (with several versions of the review service), and ratings - all managed using Istio.

You will find the source code and all the other files used in this example in your Istio [samples/bookinfo](https://github.com/istio/istio/tree/master/samples/bookinfo) directory. These steps will deploy the BookInfo application&#39;s services in an Istio-enabled environment, with Envoy sidecar proxies injected alongside each service to provide Istio functionality.

### Overview
In this guide we will deploy a simple application that displays information about a book, similar to a single catalog entry of an online book store. Displayed on the page is a description of the book, book details (ISBN, number of pages, and so on), and a few book reviews.

The BookInfo application is broken into four separate microservices:

* productpage. The productpage microservice calls the details and reviews microservices to populate the page.
* details. The details microservice contains book information.
* reviews. The reviews microservice contains book reviews. It also calls the ratings microservice.
* ratings. The ratings microservice contains book ranking information that accompanies a book review.

There are 3 versions of the reviews microservice:

* Version v1 doesn’t call the ratings service.
* Version v2 calls the ratings service, and displays each rating as 1 to 5 black stars.
* Version v3 calls the ratings service, and displays each rating as 1 to 5 red stars.

The end-to-end architecture of the application is shown below.

![bookinfo](media/bookinfo.png)

### Deploy Bookinfo

We deploy our application directly using kubectl create and its regular YAML deployment file. We will inject Envoy containers into your application pods using istioctl:

```kubectl create -f <(istioctl kube-inject -f samples/bookinfo/kube/bookinfo.yaml)```

Finally, confirm that the application has been deployed correctly by running the following commands:

Run the command:
```
kubectl get services
```
OUTPUT:
```
NAME                       CLUSTER-IP   EXTERNAL-IP   PORT(S)              AGE
details                    10.0.0.31    <none>        9080/TCP             6m
kubernetes                 10.0.0.1     <none>        443/TCP              21m
productpage                10.0.0.120   <none>        9080/TCP             6m
ratings                    10.0.0.15    <none>        9080/TCP             6m
reviews                    10.0.0.170   <none>        9080/TCP             6m
```

Run the command:
```
kubectl get pods
```

OUTPUT:
```
NAME                                        READY     STATUS    RESTARTS   AGE
details-v1-1520924117-48z17                 2/2       Running   0          6m
productpage-v1-560495357-jk1lz              2/2       Running   0          6m
ratings-v1-734492171-rnr5l                  2/2       Running   0          6m
reviews-v1-874083890-f0qf0                  2/2       Running   0          6m
reviews-v2-1343845940-b34q5                 2/2       Running   0          6m
reviews-v3-1813607990-8ch52                 2/2       Running   0          6m
```

With Envoy sidecars injected along side each service, the architecture will look like this:

![bookinfoistio](media/bookinfo-istio.png)

## Use the application <a name="use-the-application"/>

Now that it&#39;s deployed, let&#39;s see the BookInfo application in action.

First you need to get the ingress IP and port, as follows:

```
kubectl get ingress -o wide
```
OUTPUT:
```
NAME      HOSTS     ADDRESS                 PORTS     AGE
gateway   *         130.211.10.121          80        3m
```

Based on this information (Address), set the GATEWAY\_URL environment variable:

```export GATEWAY_URL=130.211.10.121:80```

NOTE : don't forget to append `:80` in the GATEWAY_URL

Once you have the address and port, check that the BookInfo app is running with curl:

Run the command:
```
curl -o /dev/null -s -w "%{http_code}\n" http://${GATEWAY_URL}/productpage
```
OUTPUT:
```
200
```

Then point your browser to _**http://$GATEWAY\_URL/productpage**_ to view the BookInfo web page. If you refresh the page several times, you should see different versions of reviews shown in the product page, presented in a round robin style (red stars, black stars, no stars), since we haven&#39;t yet used Istio to control the version routing

![Istio](media/use-app-1.png)

## Dynamically change request routing <a name="dynamically-change-request-routing"/>

The BookInfo sample deploys three versions of the reviews microservice. When you accessed the application several times, you will have noticed that the output sometimes contains star ratings and sometimes it does not. This is because without an explicit default version set, Istio will route requests to all available versions of a service in a random fashion.

We use the istioctl command line tool to control routing, adding a route rule that says all traffic should go to the v1 service. First, confirm there are no route rules installed :

```istioctl get routerules -o yaml```

No Resouces will be found. Now, create the rule (check out the source yaml file it you&#39;d like to understand how rules are specified) :

Run the command:
```
istioctl create -f samples/bookinfo/kube/route-rule-all-v1.yaml -n default
```
OUTPUT:
```
Created config route-rule/default/productpage-default at revision 136126
Created config route-rule/default/reviews-default at revision 136127
Created config route-rule/default/ratings-default at revision 136128
Created config route-rule/default/details-default at revision 136130
```

Look at the rule you&#39;ve just created:

```
istioctl get routerules -o yaml
```

Go back to the Bookinfo application (http://$GATEWAY\_URL/productpage) in your browser. You should see the BookInfo application productpage displayed. Notice that the productpage is displayed with no rating stars since reviews:v1 does not access the ratings service.

To test reviews:v2, but only for a certain user, let&#39;s create this rule:

```
istioctl create -f samples/bookinfo/kube/route-rule-reviews-test-v2.yaml -n default
```

Check out the route-rule-reviews-test-v2.yaml file to see how this rule is specified :

```
$ cat samples/bookinfo/kube/route-rule-reviews-test-v2.yaml
```
OUTPUT:
```
apiVersion: config.istio.io/v1alpha2
kind: RouteRule
metadata:
  name: reviews-test-v2
spec:
  destination:
    name: reviews
  precedence: 2
  match:
    request:
      headers:
        cookie:
          regex: "^(.*?;)?(user=jason)(;.*)?$"
  route:
  - labels:
      version: v2
```

Look at the rule you&#39;ve just created :

```istioctl get routerule reviews-test-v2 -o yaml```

We now have a way to route some requests to use the reviews:v2 service. Can you guess how? (Hint: no passwords are needed) See how the page behaviour changes if you are logged in as no-one and &#39;jason&#39;.

You can read the [documentation page](https://istio.io/docs/tasks/traffic-management/request-routing.html) for further details on Istio&#39;s request routing.

Once the v2 version has been tested to our satisfaction, we could use Istio to send traffic from all users to v2, optionally in a gradual fashion.

For now, let&#39;s clean up the routing rules:

```
istioctl delete -f samples/bookinfo/kube/route-rule-all-v1.yaml -n default
istioctl delete -f samples/bookinfo/kube/route-rule-reviews-test-v2.yaml -n default
```

## View metrics and tracing <a name="viewing-metrics-and-tracing"/>

Istio-enabled applications can be configured to collect trace spans using, for instance, the popular Zipkin distributed tracing system. Distributed tracing lets you see the flow of requests a user makes through your system, and Istio&#39;s model allows this regardless of what language/framework/platform you use to build your application.

First, install the Zipkin addon :

```kubectl apply -f install/kubernetes/addons/zipkin.yaml```

Istio is now configured to send request information.

Now we need to update the service type from `ClusterIP` to `LoadBalancer` so we can access it from our local machines.

Run the following command to open the service configuration in an editor 

```kubectl edit svc -n istio-system zipkin```

Once it's open, scroll down and replace type `ClusterIP` with `LoadBalancer`, and save file. 

To confirm updates were successfully applied run:

```
kubectl get svc -n istio-system zipkin
```

```
NAME      TYPE           CLUSTER-IP     EXTERNAL-IP      PORT(S)          AGE
zipkin    LoadBalancer   10.23.253.83   35.203.182.243   9411:31671/TCP   33m
```

Notice the `External IP` assigned to the service. 

Open your browser to http://<EXTERNAL-IP>:9411 replacing with the actual IP from your service.

Load the Bookinfo application again (http://$GATEWAY_URL/productpage).

Select a trace from the list, and you will now see something similar to the following:

![Istio](media/metrics-1.png)

You can see how long each microservice call took, including the Istio checks.

You can read the [documentation page](https://istio.io/docs/tasks/telemetry/distributed-tracing.html) for further details on Istio&#39;s distributed request tracing.

## Monitoring for Istio <a name="monitoring-for-istio"/>

This task shows you how to setup and use the Istio Dashboard to monitor mesh traffic. As part of this task, you will install the Grafana Istio addon and use the web-based interface for viewing service mesh traffic data.

First, install the Prometheus addon :

```kubectl apply -f install/kubernetes/addons/prometheus.yaml```

Istio is now configured to send monitoring information to Prometheus.

Next, we install the Grafana addon:

```kubectl apply -f install/kubernetes/addons/grafana.yaml```

Grafana will be used to visualize the data prometheus.

Now we need to update the service type from `ClusterIP` to `LoadBalancer` so we can access it from our local machines.

Run the following command to open the service configuration in an editor 

```kubectl edit svc -n istio-system grafana```

Once it's open, scroll down and replace type `ClusterIP` with `LoadBalancer`, and save file.

To confirm updates were successfully applied run:

```
kubectl get svc -n istio-system grafana
```
Should see something like:

```
NAME      TYPE           CLUSTER-IP    EXTERNAL-IP      PORT(S)          AGE
grafana   LoadBalancer   10.23.244.8   35.199.150.241   3000:32756/TCP   4m
```

Notice the `External IP` assigned to the service. 

Open your browser to http://<EXTERNAL-IP>:3000 replacing with the actual IP from your service.



Load the Bookinfo application again (http://$GATEWAY_URL/productpage).

In the top left click the dropdown and choose "Istio Dashboard", and you will now see something similar to the following:

 ![monitoring](media/monitoring-1.png)

## Generating a Service Graph <a name="generate-graph"/>

This task shows you how to generate a graph of services within an Istio mesh. As part of this task, you will install the ServiceGraph addon and use the web-based interface for viewing service graph of the service mesh.

First, install the Service Graph addon :

```kubectl apply -f install/kubernetes/addons/servicegraph.yaml```

Now we need to update the service type from `ClusterIP` to `LoadBalancer` so we can access it from our local machines.

Run the following command to open the service configuration in an editor 

```kubectl edit svc -n istio-system servicegraph``

Once it's open, scroll down and replace type `ClusterIP` with `LoadBalancer`, and save file.

To confirm updates were successfully applied run:

```
kubectl get svc -n istio-system servicegraph
```

Should see something like:

```
NAME           TYPE           CLUSTER-IP      EXTERNAL-IP      PORT(S)          AGE
servicegraph   LoadBalancer   10.23.248.204   35.203.158.146   8088:31262/TCP   9m
```

Notice the `External IP` assigned to the service. 

Open your browser to http://<EXTERNAL-IP>:8088/dotviz replacing with the actual IP from your service.

You will now see something similar to the following:

![servicegraph](media/servicegraph-1.png)

## Fault Injection <a name="fault-injection"/>

This task shows how to inject delays and test the resiliency of your application.

*_Note: This assumes you don’t have any routes set yet. If you’ve already created conflicting route rules for the sample, you’ll need to use replace rather than create in one or both of the following commands._*

To test our BookInfo application microservices for resiliency, we will inject a 7s delay between the reviews:v2 and ratings microservices, for user “jason”. Since the reviews:v2 service has a 10s timeout for its calls to the ratings service, we expect the end-to-end flow to continue without any errors.

Create a fault injection rule to delay traffic coming from user “jason” (our test user)

```
istioctl create -f samples/bookinfo/kube/route-rule-ratings-test-delay.yaml
```

Run the command:
```
istioctl get routerule ratings-test-delay -o yaml
```
You should see the yaml for the routing rule. Allow several seconds to account for rule propagation delay to all pods.

### Observe application behavior

Log in as user “jason”. If the application’s front page was set to correctly handle delays, we expect it to load within approximately 7 seconds. To see the web page response times, open the Developer Tools menu in IE, Chrome or Firefox (typically, key combination _Ctrl+Shift+I or Alt+Cmd+I_), tab Network, and reload the _productpage_ web page.

You will see that the webpage loads in about 6 seconds. The reviews section will show _Sorry, product reviews are currently unavailable for this book_.

### Understanding what happened
The reason that the entire reviews service has failed is because our BookInfo application has a bug. The timeout between the productpage and reviews service is less (3s + 1 retry = 6s total) than the timeout between the reviews and ratings service (10s). These kinds of bugs can occur in typical enterprise applications where different teams develop different microservices independently. Istio’s fault injection rules help you identify such anomalies without impacting end users.

**Notice that we are restricting the failure impact to user “jason” only. If you login as any other user, you would not experience any delays**

## Security <a name="security"/>
### Testing Istio mutual TLS authentication
Through this task, you will learn how to:
* Verify the Istio mutual TLS Authentication setup
* Manually test the authentication
#### Verifying Istio CA
Verify the cluster-level CA is running:

```
kubectl get deploy -l istio=istio-ca -n istio-system
```
OUTPUT:
```
NAME       DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
istio-ca   1         1         1            1           1m
```
#### Verify Service Configuration
Verify AuthPolicy setting in ConfigMap
```
kubectl get configmap istio -o yaml -n istio-system | grep authPolicy | head -1
```
Istio mutual TLS authentication is enabled if the line **authPolicy: MUTUAL_TLS** is uncommented (doesn’t have a **#**).
#### Testing the authentication setup
We are going to install a sample application into the cluster and try and access the services directly.

Prior to the next lab we need to install Docker with the following command:
```
curl -fsSL get.docker.com | bash && sudo usermod -aG docker play
```

After installing Docker go ahead and logout/log back in.

After logging back in we need to add `istioctl` back to our `PATH`
```
export PATH=$PWD/bin:$PATH
```

1. Switch to the sample app folder
```
git clone https://github.com/srinandan/istio-workshop.git && cd istio-workshop/mtlstest
```

2. Set the PROJECT_ID as the environment variable
```
export PROJECT_ID=$(gcloud info --format='value(config.project)')
```

3. Edit the Kubernetes configuration file (mtlstest.yaml) and add the PROJECT_ID
```
vi mtlstest.yaml
```

change this and add the project id:
```
image: gcr.io/PROJECT_ID/mtlstest:latest
```
save the file.

4. Build the docker image and push it to GCR (Google Container Repo)
```
./dockerbuild.sh
```
NOTE: you may have to run "chmod +x dockerbuild.sh"

5. Deploy the app to Kubernetes
```
./k8ssetup.sh
```

6. Verify the application was deployed successfully, by checking Pods and Services
```
kubectl get pods
```

```
NAME                              READY     STATUS    RESTARTS   AGE
details-v1-8f6644c67-nqdpk        2/2       Running   0          1h
mtlstest-5c8fb7d7cf-khvkr         2/2       Running   0          1m
productpage-v1-5c69df955f-ngpr4   2/2       Running   0          1h
ratings-v1-65f9fbd5f5-mgr82       2/2       Running   0          1h
reviews-v1-db5c9cd59-zdmz4        2/2       Running   0          1h
reviews-v2-5fb57bccc5-kbpbt       2/2       Running   0          1h
reviews-v3-5884c46f75-f5697       2/2       Running   0          1h
```

```
kubectl get svc
```


OUTPUT:
```
NAME          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
details       ClusterIP   10.59.254.1     <none>        9080/TCP   12m
kubernetes    ClusterIP   10.59.240.1     <none>        443/TCP    18m
mtlstest      ClusterIP   10.59.253.170   <none>        8080/TCP   7m
productpage   ClusterIP   10.59.251.133   <none>        9080/TCP   12m
ratings       ClusterIP   10.59.251.105   <none>        9080/TCP   12m
reviews       ClusterIP   10.59.250.46    <none>        9080/TCP   12m
```
NOTE: The cluster IP for the **details** app. This app is running on port 9080

7. Access the mtltest pod
```
kubectl exec -it mtlstest-bbf7bd6c-9rmwn /bin/bash
```

8. Run cURL to access to the details app
```
curl -k -v https://details:9080/details/0
```

OUTPUT:
```
* About to connect() to 10.59.254.1 port 9080 (#0)
*   Trying 10.59.254.1...
* Connected to 10.59.254.1 (10.59.254.1) port 9080 (#0)
* Initializing NSS with certpath: sql:/etc/pki/nssdb
* NSS error -12263 (SSL_ERROR_RX_RECORD_TOO_LONG)
* SSL received a record that exceeded the maximum permissible length.
* Closing connection 0
curl: (35) SSL received a record that exceeded the maximum permissible length.
```
**NOTE**: If security (mTLS) was **NOT** enabled on the services, you would have see the output (status 200)
#### Accessing the Service

We are now going to access the service with the appropriate keys and certs.

1. Get the CA Root Cert, Certificate and Key from Kubernetes secrets
```
kubectl get secret istio.default -o jsonpath='{.data.root-cert\.pem}' | base64 --decode > root-cert.pem
kubectl get secret istio.default -o jsonpath='{.data.cert-chain\.pem}' | base64 --decode > cert-chain.pem
kubectl get secret istio.default -o jsonpath='{.data.key\.pem}' | base64 --decode > key.pem
```

2. Copy the files to the mtlstest POD
```
kubectl cp root-cert.pem mtlstest-bbf7bd6c-gfpjk:/tmp -c mtlstest
kubectl cp cert-chain.pem mtlstest-bbf7bd6c-gfpjk:/tmp -c mtlstest
kubectl cp key.pem mtlstest-bbf7bd6c-gfpjk:/tmp -c mtlstest
```

3. Start a bash to the mtlstest POD
```
kubectl get pods
```
OUTPUT:
```
NAME                              READY     STATUS    RESTARTS   AGE
details-v1-845458947b-4xt2j       2/2       Running   0          5h
mtlstest-bbf7bd6c-gfpjk           2/2       Running   0          45m
productpage-v1-54d4776d48-z8xxv   2/2       Running   0          5h
```

```
kubectl exec -it mtlstest-bbf7bd6c-gfpjk /bin/bash
```

4. Move the PEM files to the appropriate folder (/etc/certs - which is the default folder)
```
mkdir /etc/certs
```
```
mv /tmp/*.pem /etc/certs/
```

5. Create a new user and group
**NOTE:** Envoy does **NOT** intercept traffic from "root" user. Therefore we will create a test user
```
 groupadd mtlstest
 useradd mtlstest -g mtlstest
```
6. Change to the test user "mtlstest"
```
su - mtlstest
```

7. Access the application
```
curl -v http://details:9080/details/0
```
OUTPUT:
```
* About to connect() to details port 9080 (#0)
*   Trying 10.59.254.1...
* Connected to details (10.59.254.1) port 9080 (#0)
> GET /details/0 HTTP/1.1
> User-Agent: curl/7.29.0
> Host: details:9080
> Accept: */*
>
< HTTP/1.1 200 OK
< content-type: application/json
< server: envoy
< date: Mon, 05 Feb 2018 04:44:14 GMT
< content-length: 178
< x-envoy-upstream-service-time: 54
<
* Connection #0 to host details left intact
{"id":0,"author":"William Shakespeare","year":1595,"type":"paperback","pages":200,"publisher":"PublisherA","language":"English","ISBN-10":"1234567890","ISBN-13":"123-1234567890"}[mtlstest@mtlstest-bbf7bd6c-gfpjk ~]
```
**NOTE**:
1. You didn't have to specify _https_ when accessing the service.
2. Envoy automatically established mTLS between the consumer (mtlstest) and the provider (details)
#### Preventing Unauthorized access
We saw how an application (mtlstest) was able access the service with the necessary key and cert. Istio also helps you prevent such access. In the application we have, the _details_ application must only be accessed by the _productpage_ application.

We are first going to create a service account for the _productpage_ application. For more information about service accounts, please refer [here](https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/). Run the command:
```
kubectl apply -f <(istioctl kube-inject -f bookinfo-add-serviceaccount.yaml)
```

Output:
```
serviceaccount "bookinfo-productpage" created
Warning: kubectl apply should be used on resource created by either kubectl create --save-config or kubectl apply
deployment "productpage-v1" configured
```
**NOTE**: It is safe to ignore this warning.

We are now going to deploy a mixer rule that denies access to other services (services that are not _productpage_). Review this snippet:
```
spec:
  match: destination.labels["app"] == "details" && source.user != "cluster.local/ns/default/sa/bookinfo-productpage"
  actions:
  - handler: denyproductpagehandler.denier
    instances: [ denyproductpagerequest.checknothing ]
```
The match string says if the target/destination service is _details_ and the source (service account) is not productpage, then deny access. The term _source.user_ is automatically populated by Envoy during the mTLS handshake. It is the identity of the immediate sender of the request, authenticated by mTLS. Therefore we can trust the value contained within it. Now we will deploy this rule.

```
istioctl create -f mixer-rule-deny-others.yaml
```
Output:
```
Created config denier/default/denyproductpagehandler at revision 165636
Created config checknothing/default/denyproductpagerequest at revision 165637
Created config rule/default/denyproductpage at revision 165638
```

Now, try to access the service again.

```
kubectl exec -it mtlstest-bbf7bd6c-gfpjk /bin/bash
```
```
su - mtlstest
```
```
curl -v http://details:9080/details/0
```
Output:
```
* About to connect() to details port 9080 (#0)
*   Trying 10.59.254.1...
* Connected to details (10.59.254.1) port 9080 (#0)
> GET /details/0 HTTP/1.1
> User-Agent: curl/7.29.0
> Host: details:9080
> Accept: */*
>
< HTTP/1.1 403 Forbidden
< content-length: 67
< content-type: text/plain
< date: Tue, 06 Feb 2018 01:03:05 GMT
< server: envoy
< x-envoy-upstream-service-time: 35
<
* Connection #0 to host details left intact
PERMISSION_DENIED:denyproductpagehandler.denier.default:Not allowed
```

### Further Reading
Learn more about the design principles behind Istio’s automatic mTLS authentication between all services in this [blog](https://istio.io/blog/istio-auth-for-microservices.html)

## Request routing 
This task shows you how to configure dynamic request routing based on weights and HTTP headers.

## Content-based routing

Because the Bookinfo sample deploys 3 versions of the reviews microservice,
we need to set a default route.
Otherwise if you access the application several times, you'll notice that sometimes the output contains
star ratings.
This is because without an explicit default version set, Istio will
route requests to all available versions of a service in a random fashion.

> This task assumes you don't have any routes set yet. Because we've already deployed some routes we are going to
use `replace` rather than `create` in the following commands.

1. Set the default version for all microservices to v1.

   ```bash
   istioctl replace -f samples/bookinfo/kube/route-rule-all-v1.yaml
   ```

    You can display the routes that are defined with the following command:

   ```bash
   istioctl get routerules -o yaml
   ```
   ```yaml
   apiVersion: config.istio.io/v1alpha2
   kind: RouteRule
   metadata:
     name: details-default
     namespace: default
     ...
   spec:
     destination:
       name: details
     precedence: 1
     route:
     - labels:
         version: v1
   ---
   apiVersion: config.istio.io/v1alpha2
   kind: RouteRule
   metadata:
     name: productpage-default
     namespace: default
     ...
   spec:
     destination:
       name: productpage
     precedence: 1
     route:
     - labels:
         version: v1
   ---
   apiVersion: config.istio.io/v1alpha2
   kind: RouteRule
   metadata:
     name: ratings-default
     namespace: default
     ...
   spec:
     destination:
       name: ratings
     precedence: 1
     route:
     - labels:
         version: v1
   ---
   apiVersion: config.istio.io/v1alpha2
   kind: RouteRule
   metadata:
     name: reviews-default
     namespace: default
     ...
   spec:
     destination:
       name: reviews
     precedence: 1
     route:
     - labels:
         version: v1
   ---
   ```

   Since rule propagation to the proxies is asynchronous, you should wait a few seconds for the rules
   to propagate to all pods before attempting to access the application.

1. Open the Bookinfo URL (http://$GATEWAY_URL/productpage) in your browser

   You should see the Bookinfo application productpage displayed.
   Notice that the `productpage` is displayed with no rating stars since `reviews:v1` does not access the ratings service.

1. Route a specific user to `reviews:v2`

   Lets enable the ratings service for test user "jason" by routing productpage traffic to
   `reviews:v2` instances.

   ```bash
   istioctl create -f samples/bookinfo/kube/route-rule-reviews-test-v2.yaml
   ```

   Confirm the rule is created:

   ```bash
   istioctl get routerule reviews-test-v2 -o yaml
   ```
   ```yaml
   apiVersion: config.istio.io/v1alpha2
   kind: RouteRule
   metadata:
     name: reviews-test-v2
     namespace: default
     ...
   spec:
     destination:
       name: reviews
     match:
       request:
         headers:
           cookie:
             regex: ^(.*?;)?(user=jason)(;.*)?$
     precedence: 2
     route:
     - labels:
         version: v2
   ```

1. Log in as user "jason" at the `productpage` web page.

   You should now see ratings (1-5 stars) next to each review. Notice that if you log in as
   any other user, you will continue to see `reviews:v1`.

## Understanding what happened

In this task, you used Istio to send 100% of the traffic to the v1 version of each of the Bookinfo
services. You then set a rule to selectively send traffic to version v2 of the reviews service based
on a header (i.e., a user cookie) in a request.

Once the v2 version has been tested to our satisfaction, we could use Istio to send traffic from
all users to v2, optionally in a gradual fashion. We'll explore this in a separate task.

## Cleanup

* Remove the application routing rules.

  ```bash
  istioctl delete -f samples/bookinfo/kube/route-rule-all-v1.yaml
  istioctl delete -f samples/bookinfo/kube/route-rule-reviews-test-v2.yaml
  ```

## Traffic migration

This task shows you how to gradually migrate traffic from an old to new version of a service.
With Istio, we can migrate the traffic in a gradual fashion by using a sequence of rules
with weights less than 100 to migrate traffic in steps, for example 10, 20, 30, ... 100%.
For simplicity this task will migrate the traffic from `reviews:v1` to `reviews:v3` in just
two steps: 50%, 100%.

## Weight-based version routing

1. Set the default version for all microservices to v1.

   ```bash
   istioctl create -f samples/bookinfo/kube/route-rule-all-v1.yaml
   ```

1. Confirm v1 is the active version of the `reviews` service by opening http://$GATEWAY_URL/productpage in your browser.

   You should see the Bookinfo application productpage displayed.
   Notice that the `productpage` is displayed with no rating stars since `reviews:v1` does not access the ratings service.

   > If you previously ran the [request routing](./request-routing.html) task, you may need to either log out
   as test user "jason" or delete the test rules that were created exclusively for him:

   ```bash
   istioctl delete routerule reviews-test-v2
   ```

1. First, transfer 50% of the traffic from `reviews:v1` to `reviews:v3` with the following command:

   ```bash
   istioctl replace -f samples/bookinfo/kube/route-rule-reviews-50-v3.yaml
   ```

   Notice that we are using `istioctl replace` instead of `create`.

   Confirm the rule was replaced:

   ```bash
   istioctl get routerule reviews-default -o yaml
   ```
   ```yaml
   apiVersion: config.istio.io/v1alpha2
   kind: RouteRule
   metadata:
     name: reviews-default
     namespace: default
   spec:
     destination:
       name: reviews
     precedence: 1
     route:
     - labels:
         version: v1
       weight: 50
     - labels:
         version: v3
       weight: 50
   ```

1. Refresh the `productpage` in your browser and you should now see *red* colored star ratings approximately 50% of the time.

   > With the current Envoy sidecar implementation, you may need to refresh the `productpage` very many times
   > to see the proper distribution. It may require 15 refreshes or more before you see any change. You can modify the rules to route 90% of the traffic to v3 to see red stars more often.

1. When version v3 of the `reviews` microservice is considered stable, we can route 100% of the traffic to `reviews:v3`:

   ```bash
   istioctl replace -f samples/bookinfo/kube/route-rule-reviews-v3.yaml
   ```

   You can now log into the `productpage` as any user and you should always see book reviews
   with *red* colored star ratings for each review.

## Understanding what happened

In this task we migrated traffic from an old to new version of the `reviews` service using Istio's
weighted routing feature. Note that this is very different than version migration using deployment features
of container orchestration platforms, which use instance scaling to manage the traffic.
With Istio, we can allow the two versions of the `reviews` service to scale up and down independently,
without affecting the traffic distribution between them.
For more about version routing with autoscaling, check out [Canary Deployments using Istio]({{home}}/blog/canary-deployments-using-istio.html).

## Cleanup

* Remove the application routing rules.

  ```bash
  istioctl delete -f samples/bookinfo/kube/route-rule-all-v1.yaml
  ```

## Traffic mirroring 

This task demonstrates Istio's traffic shadowing/mirroring capabilities. Traffic mirroring is a powerful concept that allows feature teams to bring
changes to production with as little risk as possible. Mirroring brings a copy of live traffic to a mirrored service and happens out of band of the critical request path for the primary service.

* Start two versions of the `httpbin` service that have access logging enabled

httpbin-v1:

```bash
cat <<EOF | istioctl kube-inject -f - | kubectl create -f -
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: httpbin-v1
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: httpbin
        version: v1
    spec:
      containers:
      - image: docker.io/kennethreitz/httpbin
        imagePullPolicy: IfNotPresent
        name: httpbin
        command: ["gunicorn", "--access-logfile", "-", "-b", "0.0.0.0:8080", "httpbin:app"]
        ports:
        - containerPort: 8080
EOF
```
httpbin-v2:

```bash
cat <<EOF | istioctl kube-inject -f - | kubectl create -f -
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: httpbin-v2
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: httpbin
        version: v2
    spec:
      containers:
      - image: docker.io/kennethreitz/httpbin
        imagePullPolicy: IfNotPresent
        name: httpbin
        command: ["gunicorn", "--access-logfile", "-", "-b", "0.0.0.0:8080", "httpbin:app"]
        ports:
        - containerPort: 8080
EOF
```

httpbin Kubernetes service:

 ```bash
cat <<EOF | kubectl create -f -
apiVersion: v1
kind: Service
metadata:
  name: httpbin
  labels:
    app: httpbin
spec:
  ports:
  - name: http
    port: 8080
  selector:
    app: httpbin
EOF
```
* Start the `sleep` service so we can use `curl` to provide load

sleep service:

```bash
cat <<EOF | istioctl kube-inject -f - | kubectl create -f -
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: sleep
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: sleep
    spec:
      containers:
      - name: sleep
        image: tutum/curl
        command: ["/bin/sleep","infinity"]
        imagePullPolicy: IfNotPresent
EOF
```

## Mirroring

Let's set up a scenario to demonstrate the traffic-mirroring capabilities of Istio. We have two versions of our `httpbin` service. By default Kubernetes will load balance across both versions of the service. We'll use Istio to force all traffic to v1 of the `httpbin` service.

### Creating default routing policy

1. Create a default route rule to route all traffic to `v1` of our `httpbin` service:

```bash
cat <<EOF | istioctl create -f -
apiVersion: config.istio.io/v1alpha2
kind: RouteRule
metadata:
  name: httpbin-default-v1
spec:
  destination:
    name: httpbin
  precedence: 5
  route:
  - labels:
      version: v1
EOF
```

Now all traffic should go to `httpbin v1` service. Let's try sending in some traffic:

```bash
export SLEEP_POD=$(kubectl get pod -l app=sleep -o jsonpath={.items..metadata.name})
kubectl exec -it $SLEEP_POD -c sleep -- sh -c 'curl  http://httpbin:8080/headers'

{
  "headers": {
    "Accept": "*/*",
    "Content-Length": "0",
    "Host": "httpbin:8080",
    "User-Agent": "curl/7.35.0",
    "X-B3-Sampled": "1",
    "X-B3-Spanid": "eca3d7ed8f2e6a0a",
    "X-B3-Traceid": "eca3d7ed8f2e6a0a",
    "X-Ot-Span-Context": "eca3d7ed8f2e6a0a;eca3d7ed8f2e6a0a;0000000000000000"
  }
}
```

If we check the logs for `v1` and `v2` of our `httpbin` pods, we should see access log entries for only `v1`:

```bash
kubectl logs -f httpbin-v1-2113278084-98whj -c httpbin
```
```xxx
127.0.0.1 - - [07/Feb/2018:00:07:39 +0000] "GET /headers HTTP/1.1" 200 349 "-" "curl/7.35.0"
```

1. Create a route rule to mirror traffic to v2

```bash
cat <<EOF | istioctl create -f -
apiVersion: config.istio.io/v1alpha2
kind: RouteRule
metadata:
  name: mirror-traffic-to-httbin-v2
spec:
  destination:
    name: httpbin
  precedence: 11
  route:
  - labels:
      version: v1
    weight: 100
  - labels:
      version: v2
    weight: 0
  mirror:
    name: httpbin
    labels:
      version: v2
EOF
```

This route rule specifies we route 100% of the traffic to v1 and 0% to v2. At the moment, it's necessary to call out the v2 service explicitly because this is
what creates the envoy-cluster definitions in the background. In future versions, we'll work to improve this so we don't have to explicitly specify a 0% weighted routing.

The last stanza specifies we want to mirror to the `httpbin v2` service. When traffic gets mirrored, the requests are sent to the mirrored service with its Host/Authority header appended with *-shadow*. For example, *cluster-1* becomes *cluster-1-shadow*. Also important to realize is that these requests are mirrored as "fire and forget", i.e., the responses are discarded.

Now if we send in traffic:

```bash
kubectl exec -it $SLEEP_POD -c sleep -- sh -c 'curl  http://httpbin:8080/headers'
```

We should see access logging for both `v1` and `v2`. The access logs created in `v2` is the mirrored requests that are actually going to `v1`.

## Cleaning up

1. Remove the rules.

   ```bash
   istioctl delete routerule mirror-traffic-to-httbin-v2
   istioctl delete routerule httpbin-default-v1
   ```

1. Shutdown the [httpbin](https://github.com/istio/istio/tree/master/samples/httpbin) service and client.

   ```bash
   kubectl delete deploy httpbin-v1 httpbin-v2 sleep
   kubectl delete svc httpbin
   ```

# Lab Complete 
