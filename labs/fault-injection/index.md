## Fault Injection 

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
## Circuit Breaker 
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


Run the commands:
```
kubectl apply -f <(istioctl kube-inject -f samples/httpbin/sample-client/fortio-deploy.yaml)
```

Set environment variable
```
export FORTIO_POD=$(kubectl get pods -lapp=fortio -o 'jsonpath={.items[0].metadata.name}')
```

Log in to the client pod and use the fortio tool to call httpbin. Pass in -curl to indicate that you just want to make one call:
```
kubectl exec "$FORTIO_POD" -c fortio -- /usr/bin/fortio curl -quiet http://httpbin:8000/get
```

You can see the request succeeded! Now, it’s time to break something.

### Tripping the circuit breaker
In the DestinationRule settings, you specified maxConnections: 1 and http1MaxPendingRequests: 1. These rules indicate that if you exceed more than one connection and request concurrently, you should see some failures when the istio-proxy opens the circuit for further requests and connections.

1. Call the service with two concurrent connections (-c 2) and send 20 requests (-n 20):
```
kubectl exec "$FORTIO_POD" -c fortio -- /usr/bin/fortio load -c 2 -qps 0 -n 20 -loglevel Warning http://httpbin:8000/get
```

```
20:33:46 I logger.go:97> Log level is now 3 Warning (was 2 Info)
Fortio 1.3.1 running at 0 queries per second, 6->6 procs, for 20 calls: http://httpbin:8000/get
Starting at max qps with 2 thread(s) [gomax 6] for exactly 20 calls (10 per thread + 0)
20:33:46 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:33:47 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:33:47 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
Ended after 59.8524ms : 20 calls. qps=334.16
Aggregated Function Time : count 20 avg 0.0056869 +/- 0.003869 min 0.000499 max 0.0144329 sum 0.113738
# range, mid point, percentile, count
>= 0.000499 <= 0.001 , 0.0007495 , 10.00, 2
> 0.001 <= 0.002 , 0.0015 , 15.00, 1
> 0.003 <= 0.004 , 0.0035 , 45.00, 6
> 0.004 <= 0.005 , 0.0045 , 55.00, 2
> 0.005 <= 0.006 , 0.0055 , 60.00, 1
> 0.006 <= 0.007 , 0.0065 , 70.00, 2
> 0.007 <= 0.008 , 0.0075 , 80.00, 2
> 0.008 <= 0.009 , 0.0085 , 85.00, 1
> 0.011 <= 0.012 , 0.0115 , 90.00, 1
> 0.012 <= 0.014 , 0.013 , 95.00, 1
> 0.014 <= 0.0144329 , 0.0142165 , 100.00, 1
# target 50% 0.0045
# target 75% 0.0075
# target 90% 0.012
# target 99% 0.0143463
# target 99.9% 0.0144242
Sockets used: 4 (for perfect keepalive, would be 2)
Code 200 : 17 (85.0 %)
Code 503 : 3 (15.0 %)
Response Header Sizes : count 20 avg 195.65 +/- 82.19 min 0 max 231 sum 3913
Response Body/Total Sizes : count 20 avg 729.9 +/- 205.4 min 241 max 817 sum 14598
All done 20 calls (plus 0 warmup) 5.687 ms avg, 334.2 qps
```
It’s interesting to see that almost all requests made it through! The `istio-proxy` does allow for some leeway.
```
Code 200 : 17 (85.0 %)
Code 503 : 3 (15.0 %)
```

2. Bring the number of concurrent connections up to 3:
```
kubectl exec "$FORTIO_POD" -c fortio -- /usr/bin/fortio load -c 3 -qps 0 -n 30 -loglevel Warning http://httpbin:8000/get
```

```
20:32:30 I logger.go:97> Log level is now 3 Warning (was 2 Info)
Fortio 1.3.1 running at 0 queries per second, 6->6 procs, for 30 calls: http://httpbin:8000/get
Starting at max qps with 3 thread(s) [gomax 6] for exactly 30 calls (10 per thread + 0)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
20:32:30 W http_client.go:679> Parsed non ok code 503 (HTTP/1.1 503)
Ended after 51.9946ms : 30 calls. qps=576.98
Aggregated Function Time : count 30 avg 0.0040001633 +/- 0.003447 min 0.0004298 max 0.015943 sum 0.1200049
# range, mid point, percentile, count
>= 0.0004298 <= 0.001 , 0.0007149 , 16.67, 5
> 0.001 <= 0.002 , 0.0015 , 36.67, 6
> 0.002 <= 0.003 , 0.0025 , 50.00, 4
> 0.003 <= 0.004 , 0.0035 , 60.00, 3
> 0.004 <= 0.005 , 0.0045 , 66.67, 2
> 0.005 <= 0.006 , 0.0055 , 76.67, 3
> 0.006 <= 0.007 , 0.0065 , 83.33, 2
> 0.007 <= 0.008 , 0.0075 , 86.67, 1
> 0.008 <= 0.009 , 0.0085 , 90.00, 1
> 0.009 <= 0.01 , 0.0095 , 96.67, 2
> 0.014 <= 0.015943 , 0.0149715 , 100.00, 1
# target 50% 0.003
# target 75% 0.00583333
# target 90% 0.009
# target 99% 0.0153601
# target 99.9% 0.0158847
Sockets used: 20 (for perfect keepalive, would be 3)
Code 200 : 11 (36.7 %)
Code 503 : 19 (63.3 %)
Response Header Sizes : count 30 avg 84.366667 +/- 110.9 min 0 max 231 sum 2531
Response Body/Total Sizes : count 30 avg 451.86667 +/- 277.1 min 241 max 817 sum 13556
All done 30 calls (plus 0 warmup) 4.000 ms avg, 577.0 qps
```

Now you start to see the expected circuit breaking behavior. Only 63.3% of the requests succeeded and the rest were trapped by circuit breaking:
```
Code 200 : 19 (63.3 %)
Code 503 : 11 (36.7 %)
```
3. Query the istio-proxy stats to see more:

```
kubectl exec "$FORTIO_POD" -c istio-proxy -- pilot-agent request GET stats | grep httpbin | grep pending

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
kubectl delete destinationrule httpbin
kubectl delete deploy httpbin fortio-deploy
kubectl delete svc httpbin fortio
```