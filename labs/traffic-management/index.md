## Summary 
In this lab you will configure Istio for traffic management, fault injection and mirroring. 

# Table of Contents
1. [Mirroring Traffic](#mirror-traffic)
1. [Dynamically change request routing](#dynamically-change-request-routing)
2. [Fault Injection](#fault-injection)
3. [Circuit Breaker](#circuit)

## Traffic mirroring (shadow traffic) <a name="mirror-traffic"/>

A deployment brings new code to production but it takes no production traffic. Once in the production environment, service teams are free to run smoke tests, integration tests, etc without impacting any users. A service team should feel free to deploy as frequently as it wishes.

A release brings live traffic to a deployment but may require signoff from “the business stakeholders”. Ideally, bringing traffic to a deployment can be done in a controlled manner to reduce risk. For example, we may want to bring internal-user traffic to the deployment first. Or we may want to bring a small fraction, say 1%, of traffic to the deployment. If any of these release rollout strategies (internal, non-paying, 1% traffic, etc) exhibit undesirable behavior (thus the need for strong observability) then we can rollback.

### Dark traffic 
One strategy we can use to reduce risk for our releases, before we even expose to any type of user, is to shadow live traffic to our deployment. With traffic shadowing, we can take a fraction of traffic and route it to our new deployment and observe how it behaves. We can do things like test for errors, exceptions, performance, and result parity. 
With Istio, we can do this kind of traffic control by mirroring traffic from one service to another. Let’s take a look at an example.

In this task, you will first force all traffic to v1 of a test service. Then, you will apply a rule to mirror a portion of traffic to v2.

Start by deploying two versions of the httpbin service that have access logging enabled:   

**httpbin-v1:**

``` 
   cat <<EOF | istioctl kube-inject -f - | kubectl create -f -
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: httpbin-v1
    spec:
      replicas: 1
      selector:
        matchLabels:
          app: httpbin
          version: v1
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
            command: ["gunicorn", "--access-logfile", "-", "-b", "0.0.0.0:80", "httpbin:app"]
            ports:
            - containerPort: 80
    EOF
``` 


**httpbin-v2:**

```
   cat <<EOF | istioctl kube-inject -f - | kubectl create -f -
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: httpbin-v2
    spec:
      replicas: 1
      selector:
        matchLabels:
          app: httpbin
          version: v2
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
            command: ["gunicorn", "--access-logfile", "-", "-b", "0.0.0.0:80", "httpbin:app"]
            ports:
            - containerPort: 80
    EOF
```

**httpbin Kubernetes service:**

```
   kubectl create -f - <<EOF
    apiVersion: v1
    kind: Service
    metadata:
      name: httpbin
      labels:
        app: httpbin
    spec:
      ports:
      - name: http
        port: 8000
        targetPort: 80
      selector:
        app: httpbin
    EOF
```
*   Start the `sleep` service so you can use `curl` to provide load:

    **sleep service:**

```
   cat <<EOF | istioctl kube-inject -f - | kubectl create -f -
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: sleep
    spec:
      replicas: 1
      selector:
        matchLabels:
          app: sleep
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

## Creating a default routing policy

By default Kubernetes load balances across both versions of the `httpbin` service.
In this step, you will change that behavior so that all traffic goes to `v1`.

1.  Create a default route rule to route all traffic to `v1` of the service:

```
   kubectl apply -f - <<EOF
    apiVersion: networking.istio.io/v1alpha3
    kind: VirtualService
    metadata:
      name: httpbin
    spec:
      hosts:
        - httpbin
      http:
      - route:
        - destination:
            host: httpbin
            subset: v1
          weight: 100
    ---
    apiVersion: networking.istio.io/v1alpha3
    kind: DestinationRule
    metadata:
      name: httpbin
    spec:
      host: httpbin
      subsets:
      - name: v1
        labels:
          version: v1
      - name: v2
        labels:
          version: v2
    EOF
```
Now all traffic goes to the `httpbin:v1` service.

1. Send some traffic to the service:

```
   export SLEEP_POD=$(kubectl get pod -l app=sleep -o jsonpath={.items..metadata.name})
   kubectl exec "${SLEEP_POD}" -c sleep -- curl -s http://httpbin:8000/headers
   
    {
      "headers": {
        "Accept": "*/*",
        "Content-Length": "0",
        "Host": "httpbin:8000",
        "User-Agent": "curl/7.35.0",
        "X-B3-Parentspanid": "57784f8bff90ae0b",
        "X-B3-Sampled": "1",
        "X-B3-Spanid": "3289ae7257c3f159",
        "X-B3-Traceid": "b56eebd279a76f0b57784f8bff90ae0b",
        "X-Envoy-Attempt-Count": "1",
        "X-Forwarded-Client-Cert": "By=spiffe://cluster.local/ns/default/sa/default;Hash=20afebed6da091c850264cc751b8c9306abac02993f80bdb76282237422bd098;Subject=\"\";URI=spiffe://cluster.local/ns/default/sa/default"
      }
    }
```

1. Check the logs for `v1` and `v2` of the `httpbin` pods. You should see access
log entries for `v1` and none for `v2`:

```
   export V1_POD=$(kubectl get pod -l app=httpbin,version=v1 -o jsonpath={.items..metadata.name})
   kubectl logs "$V1_POD" -c httpbin
   
    127.0.0.1 - - [07/Mar/2018:19:02:43 +0000] "GET /headers HTTP/1.1" 200 321 "-" "curl/7.35.0"
```
  
```
  export V2_POD=$(kubectl get pod -l app=httpbin,version=v2 -o jsonpath={.items..metadata.name})
  kubectl logs "$V2_POD" -c httpbin
    <none>
```

## Mirroring traffic to v2

1.  Change the route rule to mirror traffic to v2:

```
  kubectl apply -f - <<EOF
    apiVersion: networking.istio.io/v1alpha3
    kind: VirtualService
    metadata:
      name: httpbin
    spec:
      hosts:
        - httpbin
      http:
      - route:
        - destination:
            host: httpbin
            subset: v1
          weight: 100
        mirror:
          host: httpbin
          subset: v2
        mirror_percent: 100
    EOF
```

This route rule sends 100% of the traffic to `v1`. The last stanza specifies
that you want to mirror (i.e., also send) 100% of the same traffic to the
`httpbin:v2` service. When traffic gets mirrored,
the requests are sent to the mirrored service with their Host/Authority headers
appended with `-shadow`. For example, `cluster-1` becomes `cluster-1-shadow`.

Also, it is important to note that these requests are mirrored as "fire and
forget", which means that the responses are discarded.

You can use the `mirror_percent` field to mirror a fraction of the traffic,
instead of mirroring all requests. If this field is absent, for compatibility with
older versions, all traffic will be mirrored.

1. Send in traffic:

```
  kubectl exec "${SLEEP_POD}" -c sleep -- curl -s http://httpbin:8000/headers
```
  
Now, you should see access logging for both `v1` and `v2`. The access logs
created in `v2` are the mirrored requests that are actually going to `v1`.

```
   kubectl logs "$V1_POD" -c httpbin
    127.0.0.1 - - [07/Mar/2018:19:02:43 +0000] "GET /headers HTTP/1.1" 200 321 "-" "curl/7.35.0"
    127.0.0.1 - - [07/Mar/2018:19:26:44 +0000] "GET /headers HTTP/1.1" 200 321 "-" "curl/7.35.0"
```

```
   kubectl logs "$V2_POD" -c httpbin
    127.0.0.1 - - [07/Mar/2018:19:26:44 +0000] "GET /headers HTTP/1.1" 200 361 "-" "curl/7.35.0"
```

## Cleaning up

1.  Remove the rules:

```
   kubectl delete virtualservice httpbin
   kubectl delete destinationrule httpbin
```

1.  Shutdown the `httpbin` service and client:

```
   kubectl delete deploy httpbin-v1 httpbin-v2 sleep
   kubectl delete svc httpbin
```

## Dynamically change request routing <a name="dynamically-change-request-routing"/>

The BookInfo sample deploys three versions of the reviews microservice. When you accessed the application several times, you will have noticed that the output sometimes contains star ratings and sometimes it does not. This is because without an explicit default version set, Istio will route requests to all available versions of a service in a random fashion.

Check to see if there's any current route rules:

```
kubectl get destinationrules -o yaml
```

No Resouces will be found. Now, create the rule(check out the source yaml files if you&#39;d like to understand how rules are specified) :

Run the commands:

```
kubectl apply -f samples/bookinfo/networking/virtual-service-all-v1.yaml -n default
```

```
kubectl apply -f samples/bookinfo/networking/destination-rule-all.yaml -n default
```
OUTPUT:
```
virtualservice "productpage" created
virtualservice "reviews" created
virtualservice "ratings" created
virtualservice "details" created
destinationrule "productpage" created
destinationrule "reviews" created
destinationrule "ratings" created
destinationrule "details" created
```

Look at the rule you&#39;ve just created:

```
kubectl get destinationrules -o yaml
```

Go back to the Bookinfo application (http://$GATEWAY\_URL/productpage) in your browser. You should see the BookInfo application productpage displayed. Notice that the productpage is displayed with no rating stars since reviews:v1 does not access the ratings service.

To test reviews:v2, but only for a certain user, let&#39;s create this rule:

```
kubectl apply -f samples/bookinfo/networking/virtual-service-reviews-test-v2.yaml -n default
```

Check out the route-rule-reviews-test-v2.yaml file to see how this virtual service is specified :

```
$ cat samples/bookinfo/networking/virtual-service-reviews-test-v2.yaml
```
OUTPUT:
```
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
  - match:
    - headers:
        end-user:
          exact: jason
    route:
    - destination:
        host: reviews
        subset: v2
  - route:
    - destination:
        host: reviews
        subset: v1
```

Look at the virtual service you&#39;ve just created :

```kubectl get virtualservices reviews -o yaml```

We now have a way to route some requests to use the reviews:v2 service. Can you guess how? (Hint: no passwords are needed) See how the page behavior changes if you are logged in as no-one and &#39;jason&#39;.

You can read the [documentation page](https://istio.io/docs/tasks/traffic-management/request-routing.html) for further details on Istio&#39;s request routing.

Once the v2 version has been tested to our satisfaction, we can use Istio to send traffic from all users to v2, optionally in a gradual fashion.

Now send 80% to v1 and 20% to v2. 
```
kubectl apply -f samples/bookinfo/networking/virtual-service-reviews-80-20.yaml
```
To confirm you can go refresh the page in your browser and determine that majority of the time you are hitting v1, but then about 20% of the time you hit v2.

In this task you migrated traffic from an old to new version of the reviews service using Istio’s weighted routing feature. Note that this is very different than doing version migration using the deployment features of container orchestration platforms, which use instance scaling to manage the traffic.

With Istio, you can allow the two versions of the reviews service to scale up and down independently, without affecting the traffic distribution between them.

Now let's cleanup our routing rules.

```
kubectl delete --ignore-not-found=true -f samples/bookinfo/networking/virtual-service-all-v1.yaml -n default
```

## Fault Injection <a name="fault-injection"/>

### Fault Injection using HTTP Delay
This task shows how to inject delays and test the resiliency of your application.

*_Note: This assumes you don’t have any routes set yet. If you’ve already created conflicting route rules for the sample, you’ll need to use replace rather than create in one or both of the following commands._*

To test our BookInfo application microservices for resiliency, we will inject a 7s delay between the reviews:v2 and ratings microservices, for user “jason”. Since the reviews:v2 service has a 10s timeout for its calls to the ratings service, we expect the end-to-end flow to continue without any errors.

Create a fault injection rule to delay traffic coming from user “jason” (our test user)

```
kubectl apply -f samples/bookinfo/networking/destination-rule-all.yaml
kubectl apply -f samples/bookinfo/networking/virtual-service-reviews-test-v2.yaml
```

Run the command:
```
kubectl apply -f samples/bookinfo/networking/virtual-service-ratings-test-delay.yaml
```
You should see confirmation the routing rule was created. Allow several seconds to account for rule propagation delay to all pods.

#### Observe application behavior

Log in as user “jason”. If the application’s front page was set to correctly handle delays, we expect it to load within approximately 7 seconds. To see the web page response times, open the Developer Tools menu in IE, Chrome or Firefox (typically, key combination _Ctrl+Shift+I or Alt+Cmd+I_), tab Network, and reload the _productpage_ web page.

You will see that the webpage loads in about 6 seconds. The reviews section will show _Sorry, product reviews are currently unavailable for this book_.

#### Understanding what happened
The reason that the entire reviews service has failed is because our BookInfo application has a bug. The timeout between the productpage and reviews service is less (3s + 1 retry = 6s total) than the timeout between the reviews and ratings service (10s). These kinds of bugs can occur in typical enterprise applications where different teams develop different microservices independently. Istio’s fault injection rules help you identify such anomalies without impacting end users.

**Notice that we are restricting the failure impact to user “jason” only. If you login as any other user, you would not experience any delays**

### Fault Injection using HTTP Abort
As another test of resiliency, we will introduce an HTTP abort to the ratings microservices for the user “jason”. We expect the page to load immediately unlike the delay example and display the “product ratings not available” message.

Create a fault injection rule to send an HTTP abort for user “jason”

```
kubectl apply -f samples/bookinfo/networking/virtual-service-ratings-test-abort.yaml
```

#### Observe application behavior

Login as user “jason”. If the rule propagated successfully to all pods, you should see the page load immediately with the “product ratings not available” message. Logout from user “jason” and you should see reviews show up successfully on the productpage web page

#### Remove the fault rules
Clean up the fault rules with the command:

```
kubectl delete --ignore-not-found=true -f samples/bookinfo/networking/virtual-service-all-v1.yaml
```
## Circuit Breaker <a name="circuit"/>
This task demonstrates the circuit-breaking capability for resilient applications. Circuit breaking allows developers to write applications that limit the impact of failures, latency spikes, and other undesirable effects of network peculiarities.

## Add httpbin sample app
```
kubectl apply -f <(istioctl kube-inject -f samples/httpbin/httpbin.yaml)
```

### Define a Destination Rule
DestinationRule defines policies that apply to traffic intended for a service after routing has occurred. These rules specify configuration for load balancing, connection pool size from the sidecar, and outlier detection settings to detect and evict unhealthy hosts from the load balancing pool.

Run the following command:
```
cat <<EOF | kubectl apply -f -
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: httpbin
spec:
  host: httpbin
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
    connectionPool:
      tcp:
        maxConnections: 1
      http:
        http1MaxPendingRequests: 1
        maxRequestsPerConnection: 1
    outlierDetection:
      consecutiveErrors: 1
      interval: 1s
      baseEjectionTime: 3m
      maxEjectionPercent: 100
EOF
```

This enables a destination rule that applies a circuit breaker to the details service. 

### Setup a Client application

Create a client to send traffic to the httpbin service. The client is a simple load-testing client called fortio. Fortio lets you control the number of connections, concurrency, and delays for outgoing HTTP calls. You will use this client to “trip” the circuit breaker policies you set in the DestinationRule.

Istio 1.2 has a bug with lauching the fortio deployment.  To get around this we are going to create a yaml file and then use `kubectl` to deploy it. 

Run the commands:
```
istioctl kube-inject -f samples/httpbin/sample-client/fortio-deploy.yaml --output fortio-deploy.yaml
kubectl apply -f fortio-deploy.yaml
```

Set environment variable
```
FORTIO_POD=$(kubectl get pod | grep fortio | awk '{ print $1 }')
```

Log in to the client pod and use the fortio tool to call httpbin. Pass in -curl to indicate that you just want to make one call:
```
kubectl exec -it $FORTIO_POD  -c fortio /usr/bin/fortio -- load -curl  http://httpbin:8000/get
```

You can see the request succeeded! Now, it’s time to break something.

### Tripping the circuit breaker
In the DestinationRule settings, you specified maxConnections: 1 and http1MaxPendingRequests: 1. These rules indicate that if you exceed more than one connection and request concurrently, you should see some failures when the istio-proxy opens the circuit for further requests and connections.

1. Call the service with two concurrent connections (-c 2) and send 20 requests (-n 20):
```
kubectl exec -it $FORTIO_POD  -c fortio /usr/bin/fortio -- load -c 2 -qps 0 -n 20 -loglevel Warning http://httpbin:8000/get
```

```
Fortio 0.6.2 running at 0 queries per second, 2->2 procs, for 5s: http://httpbin:8000/get
Starting at max qps with 2 thread(s) [gomax 2] for exactly 20 calls (10 per thread + 0)
23:51:10 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
Ended after 106.474079ms : 20 calls. qps=187.84
Aggregated Function Time : count 20 avg 0.010215375 +/- 0.003604 min 0.005172024 max 0.019434859 sum 0.204307492
# range, mid point, percentile, count
>= 0.00517202 <= 0.006 , 0.00558601 , 5.00, 1
> 0.006 <= 0.007 , 0.0065 , 20.00, 3
> 0.007 <= 0.008 , 0.0075 , 30.00, 2
> 0.008 <= 0.009 , 0.0085 , 40.00, 2
> 0.009 <= 0.01 , 0.0095 , 60.00, 4
> 0.01 <= 0.011 , 0.0105 , 70.00, 2
> 0.011 <= 0.012 , 0.0115 , 75.00, 1
> 0.012 <= 0.014 , 0.013 , 90.00, 3
> 0.016 <= 0.018 , 0.017 , 95.00, 1
> 0.018 <= 0.0194349 , 0.0187174 , 100.00, 1
# target 50% 0.0095
# target 75% 0.012
# target 99% 0.0191479
# target 99.9% 0.0194062
Code 200 : 19 (95.0 %)
Code 503 : 1 (5.0 %)
Response Header Sizes : count 20 avg 218.85 +/- 50.21 min 0 max 231 sum 4377
Response Body/Total Sizes : count 20 avg 652.45 +/- 99.9 min 217 max 676 sum 13049
All done 20 calls (plus 0 warmup) 10.215 ms avg, 187.8 qps
```

More requests were successful than failed.  
```
Code 200 : 19 (95.0 %)
Code 503 : 1 (5.0 %)
```

2. Bring the number of concurrent connections up to 3:
```
kubectl exec -it $FORTIO_POD  -c fortio /usr/bin/fortio -- load -c 3 -qps 0 -n 20 -loglevel Warning http://httpbin:8000/get
```

```
Fortio 0.6.2 running at 0 queries per second, 2->2 procs, for 5s: http://httpbin:8000/get
Starting at max qps with 3 thread(s) [gomax 2] for exactly 30 calls (10 per thread + 0)
23:51:51 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
23:51:51 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
23:51:51 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
23:51:51 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
23:51:51 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
23:51:51 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
23:51:51 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
23:51:51 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
23:51:51 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
23:51:51 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
23:51:51 W http.go:617> Parsed non ok code 503 (HTTP/1.1 503)
Ended after 71.05365ms : 30 calls. qps=422.22
Aggregated Function Time : count 30 avg 0.0053360199 +/- 0.004219 min 0.000487853 max 0.018906468 sum 0.160080597
# range, mid point, percentile, count
>= 0.000487853 <= 0.001 , 0.000743926 , 10.00, 3
> 0.001 <= 0.002 , 0.0015 , 30.00, 6
> 0.002 <= 0.003 , 0.0025 , 33.33, 1
> 0.003 <= 0.004 , 0.0035 , 40.00, 2
> 0.004 <= 0.005 , 0.0045 , 46.67, 2
> 0.005 <= 0.006 , 0.0055 , 60.00, 4
> 0.006 <= 0.007 , 0.0065 , 73.33, 4
> 0.007 <= 0.008 , 0.0075 , 80.00, 2
> 0.008 <= 0.009 , 0.0085 , 86.67, 2
> 0.009 <= 0.01 , 0.0095 , 93.33, 2
> 0.014 <= 0.016 , 0.015 , 96.67, 1
> 0.018 <= 0.0189065 , 0.0184532 , 100.00, 1
# target 50% 0.00525
# target 75% 0.00725
# target 99% 0.0186345
# target 99.9% 0.0188793
Code 200 : 19 (63.3 %)
Code 503 : 11 (36.7 %)
Response Header Sizes : count 30 avg 145.73333 +/- 110.9 min 0 max 231 sum 4372
Response Body/Total Sizes : count 30 avg 507.13333 +/- 220.8 min 217 max 676 sum 15214
All done 30 calls (plus 0 warmup) 5.336 ms avg, 422.2 qps
```

Now you start to see the expected circuit breaking behavior. Only 63.3% of the requests succeeded and the rest were trapped by circuit breaking:
```
Code 200 : 19 (63.3 %)
Code 503 : 11 (36.7 %)
```
3. Query the istio-proxy stats to see more:

```
 kubectl exec -it $FORTIO_POD  -c istio-proxy  -- sh -c 'curl localhost:15000/stats' | grep httpbin | grep pending
```

```
cluster.outbound|80||httpbin.springistio.svc.cluster.local.upstream_rq_pending_active: 0
cluster.outbound|80||httpbin.springistio.svc.cluster.local.upstream_rq_pending_failure_eject: 0
cluster.outbound|80||httpbin.springistio.svc.cluster.local.upstream_rq_pending_overflow: 12
cluster.outbound|80||httpbin.springistio.svc.cluster.local.upstream_rq_pending_total: 39
```

You can see 12 for the upstream_rq_pending_overflow value which means 12 calls so far have been flagged for circuit breaking.


### Cleanup
Remove the rules and delete the httpbin sample app
```
kubectl delete --ignore-not-found=true destinationrule httpbin
kubectl delete --ignore-not-found=true deploy httpbin fortio-deploy
kubectl delete --ignore-not-found=true svc httpbin
```