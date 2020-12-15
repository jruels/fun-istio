## Istio Security 

### Mutual TLS (mTLS)
In this task you are going to setup a few sample applications in different namespaces. You will then specify whether mTLS is enabled for these services and review the results.

#### Authentication
There are two types of authentication provided by Istio

* **Peer Authentication** 
For service-to-service authentication

* **Request Authentication** 
For end-user authentication. Using JSON Web Tokens (JWT)

This post deals with only Peer Authentication.

#### Peer Authentication
Peer Authentication policies are used to secure service to service communication in Kubernetes cluster with Istio Service Mesh by automating the process of generation, distribution and rotation of certificates and keys.

* Istiod automates key and certificate rotation at scale
* Istiod enables strong service-to-service and end-user authentication with built-in identity and credential management.
* Istiod maintains a CA and generates certificates to allow secure mTLS communication in the data plane.

https://istio.io/latest/docs/concepts/security/

1. Envoy is the sidecar container running along with the container running your application which proxies all the traffic in and out of the pod, sends a certificate and key request via the Envoy Secret Discovery Service (A flexible API to deliver secrets/certificates) to Istio Agent.
2. Istio Agent on receiving the request creates a certificate and private key and then sends a Certificate Signing Request(CSR) along with the necessary credentials to Istiod
3. The Certificate Authority(CA) maintained by Istiod then validates the credentials carried in the CSR and signs the CSR to generate the certificate which will only work with the private key that was generated with it.
4. The Istio agent sends the certificate received from Istiod and the private key to Envoy via the Envoy SDS API.

### Setup

Our examples use two namespaces `foo` and `bar`, with two services, `httpbin` and `sleep`, both running with an Envoy proxy. We also use second instances of `httpbin` and `sleep` running without the sidecar in the `legacy` namespace. 

Run the following:

```
kubectl create ns foo
kubectl apply -f <(istioctl kube-inject -f @samples/httpbin/httpbin.yaml@) -n foo
kubectl apply -f <(istioctl kube-inject -f @samples/sleep/sleep.yaml@) -n foo
kubectl create ns bar
kubectl apply -f <(istioctl kube-inject -f @samples/httpbin/httpbin.yaml@) -n bar
kubectl apply -f <(istioctl kube-inject -f @samples/sleep/sleep.yaml@) -n bar
kubectl create ns legacy
kubectl apply -f @samples/httpbin/httpbin.yaml@ -n legacy
kubectl apply -f @samples/sleep/sleep.yaml@ -n legacy
```

You can verify setup by sending an HTTP request with `curl` from any `sleep` pod in the namespace `foo`, `bar` or `legacy` to either `httpbin.foo`,`httpbin.bar` or `httpbin.legacy`. All requests should succeed with HTTP code 200.

For example, here is a command to check `sleep.bar` to `httpbin.foo` reachability:

```
kubectl exec "$(kubectl get pod -l app=sleep -n bar -o jsonpath={.items..metadata.name})" -c sleep -n bar -- curl http://httpbin.foo:8000/ip -s -o /dev/null -w "%{http_code}\n"
```

```
Output:
200
```

This one-liner command conveniently iterates through all reachability combinations:

```
for from in "foo" "bar" "legacy"; do for to in "foo" "bar" "legacy"; do kubectl exec "$(kubectl get pod -l app=sleep -n ${from} -o jsonpath={.items..metadata.name})" -c sleep -n ${from} -- curl "http://httpbin.${to}:8000/ip" -s -o /dev/null -w "sleep.${from} to httpbin.${to}: %{http_code}\n"; done; done
```

Output:
```
sleep.foo to httpbin.foo: 200
sleep.foo to httpbin.bar: 200
sleep.foo to httpbin.legacy: 200
sleep.bar to httpbin.foo: 200
sleep.bar to httpbin.bar: 200
sleep.bar to httpbin.legacy: 200
sleep.legacy to httpbin.foo: 200
sleep.legacy to httpbin.bar: 200
sleep.legacy to httpbin.legacy: 200
```

Verify there is no peer authentication policy in the system with the following command:

```
kubectl get peerauthentication --all-namespaces
```

Output:
```
No resources found.
```

Last but not least, verify that there are no destination rules that apply on the example services. You can do this by checking the `host:` value of existing destination rules and make sure they do not match. For example:

```
kubectl get destinationrules.networking.istio.io --all-namespaces -o yaml | grep "host:"
```


Depending on the version of Istio, you may see destination rules for hosts other then those shown. However, there should be none with hosts in the `foo`,`bar` and `legacy` namespace, nor is the match-all wildcard `*`

## Auto mutual TLS

By default, Istio tracks the server workloads migrated to Istio proxies, and configures client proxies to send mutual TLS traffic to those workloads automatically, and to send plain text traffic to workloads without sidecars.

Thus, all traffic between workloads with proxies uses mutual TLS, without you doing anything. For example, take the response from a request to `httpbin/header`.
When using mutual TLS, the proxy injects the `X-Forwarded-Client-Cert` header to the upstream request to the backend. That header's presence is evidence that mutual TLS is used. For example:

```
kubectl exec "$(kubectl get pod -l app=sleep -n foo -o jsonpath={.items..metadata.name})" -c sleep -n foo -- curl http://httpbin.foo:8000/headers -s | grep X-Forwarded-Client-Cert | sed 's/Hash=[a-z0-9]*;/Hash=<redacted>;/'
```

Output:
```
    "X-Forwarded-Client-Cert": "By=spiffe://cluster.local/ns/foo/sa/httpbin;Hash=<redacted>;Subject=\"\";URI=spiffe://cluster.local/ns/foo/sa/sleep"
```
When the server doesn't have sidecar, the `X-Forwarded-Client-Cert` header is not there, which implies requests are in plain text.

```
$ kubectl exec "$(kubectl get pod -l app=sleep -n foo -o jsonpath={.items..metadata.name})" -c sleep -n foo -- curl http://httpbin.legacy:8000/headers -s | grep X-Forwarded-Client-Cert
```

## Globally enabling Istio mutual TLS in STRICT mode

While Istio automatically upgrades all traffic between the proxies and the workloads to mutual TLS,
workloads can still receive plain text traffic. To prevent non-mutual TLS traffic for the whole mesh,
set a mesh-wide peer authentication policy with the mutual TLS mode set to `STRICT`.
The mesh-wide peer authentication policy should not have a `selector` and must be applied in the **root namespace**, for example:

```
kubectl apply -f - <<EOF
apiVersion: "security.istio.io/v1beta1"
kind: "PeerAuthentication"
metadata:
  name: "default"
  namespace: "istio-system"
spec:
  mtls:
    mode: STRICT
EOF
```

This peer authentication policy configures workloads to only accept requests encrypted with TLS.
Since it doesn't specify a value for the `selector` field, the policy applies to all workloads in the mesh.

Run the test command again:

```
for from in "foo" "bar" "legacy"; do for to in "foo" "bar" "legacy"; do kubectl exec "$(kubectl get pod -l app=sleep -n ${from} -o jsonpath={.items..metadata.name})" -c sleep -n ${from} -- curl "http://httpbin.${to}:8000/ip" -s -o /dev/null -w "sleep.${from} to httpbin.${to}: %{http_code}\n"; done; done
```

Output:
```
sleep.foo to httpbin.foo: 200
sleep.foo to httpbin.bar: 200
sleep.foo to httpbin.legacy: 200
sleep.bar to httpbin.foo: 200
sleep.bar to httpbin.bar: 200
sleep.bar to httpbin.legacy: 200
sleep.legacy to httpbin.foo: 000
command terminated with exit code 56
sleep.legacy to httpbin.bar: 000
command terminated with exit code 56
sleep.legacy to httpbin.legacy: 200
```

You see requests still succeed, except for those from the client that doesn't have proxy, `sleep.legacy`, to the server with a proxy, `httpbin.foo` or `httpbin.bar`. This is expected because mutual TLS is now strictly required, but the workload without sidecar cannot comply.

### Cleanup part 1

Remove global authentication policy and destination rules added in the session:

```
kubectl delete peerauthentication -n istio-system default
```

## Enable mutual TLS per namespace or workload

### Namespace-wide policy

To change mutual TLS for all workloads within a particular namespace, use a namespace-wide policy. The specification of the policy is the same as for a mesh-wide policy, but you specify the namespace it applies to under `metadata`. For example, the following peer authentication policy enables strict mutual TLS  for the `foo` namespace:

```
kubectl apply -f - <<EOF
apiVersion: "security.istio.io/v1beta1"
kind: "PeerAuthentication"
metadata:
  name: "default"
  namespace: "foo"
spec:
  mtls:
    mode: STRICT
EOF
```

As this policy is applied on workloads in namespace `foo` only, you should see only request from client-without-sidecar (`sleep.legacy`) to `httpbin.foo` start to fail.

```
for from in "foo" "bar" "legacy"; do for to in "foo" "bar" "legacy"; do kubectl exec "$(kubectl get pod -l app=sleep -n ${from} -o jsonpath={.items..metadata.name})" -c sleep -n ${from} -- curl "http://httpbin.${to}:8000/ip" -s -o /dev/null -w "sleep.${from} to httpbin.${to}: %{http_code}\n"; done; done
```

Output:
```
sleep.foo to httpbin.foo: 200
sleep.foo to httpbin.bar: 200
sleep.foo to httpbin.legacy: 200
sleep.bar to httpbin.foo: 200
sleep.bar to httpbin.bar: 200
sleep.bar to httpbin.legacy: 200
sleep.legacy to httpbin.foo: 000
command terminated with exit code 56
sleep.legacy to httpbin.bar: 200
sleep.legacy to httpbin.legacy: 200
```

### Enable mutual TLS per workload

To set a peer authentication policy for a specific workload, you must configure the `selector` section and specify the labels that match the desired workload. However, Istio cannot aggregate workload-level policies for outbound mutual TLS traffic to a service. Configure a destination rule to manage that behavior.

For example, the following peer authentication policy and destination rule enable strict mutual TLS for the `httpbin.bar` workload:

```
cat <<EOF | kubectl apply -n bar -f -
apiVersion: "security.istio.io/v1beta1"
kind: "PeerAuthentication"
metadata:
  name: "httpbin"
  namespace: "bar"
spec:
  selector:
    matchLabels:
      app: httpbin
  mtls:
    mode: STRICT
EOF
```

And a destination rule:

```
cat <<EOF | kubectl apply -n bar -f -
apiVersion: "networking.istio.io/v1alpha3"
kind: "DestinationRule"
metadata:
  name: "httpbin"
spec:
  host: "httpbin.bar.svc.cluster.local"
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
EOF
```

Again, run the probing command. As expected, request from `sleep.legacy` to `httpbin.bar` starts failing with the same reasons.

```
for from in "foo" "bar" "legacy"; do for to in "foo" "bar" "legacy"; do kubectl exec "$(kubectl get pod -l app=sleep -n ${from} -o jsonpath={.items..metadata.name})" -c sleep -n ${from} -- curl "http://httpbin.${to}:8000/ip" -s -o /dev/null -w "sleep.${from} to httpbin.${to}: %{http_code}\n"; done; done
```

Output:
```
sleep.foo to httpbin.foo: 200
sleep.foo to httpbin.bar: 200
sleep.foo to httpbin.legacy: 200
sleep.bar to httpbin.foo: 200
sleep.bar to httpbin.bar: 200
sleep.bar to httpbin.legacy: 200
sleep.legacy to httpbin.foo: 000
command terminated with exit code 56
sleep.legacy to httpbin.bar: 000
command terminated with exit code 56
sleep.legacy to httpbin.legacy: 200
```

```
...
sleep.legacy to httpbin.bar: 000
command terminated with exit code 56
```

To refine the mutual TLS settings per port, you must configure the `portLevelMtls` section. For example, the following peer authentication policy requires mutual TLS on all ports, except port `80`:

```
cat <<EOF | kubectl apply -n bar -f -
apiVersion: "security.istio.io/v1beta1"
kind: "PeerAuthentication"
metadata:
  name: "httpbin"
  namespace: "bar"
spec:
  selector:
    matchLabels:
      app: httpbin
  mtls:
    mode: STRICT
  portLevelMtls:
    80:
      mode: DISABLE
EOF
```

As before, you also need a destination rule:

```
cat <<EOF | kubectl apply -n bar -f -
apiVersion: "networking.istio.io/v1alpha3"
kind: "DestinationRule"
metadata:
  name: "httpbin"
spec:
  host: httpbin.bar.svc.cluster.local
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
    portLevelSettings:
    - port:
        number: 8000
      tls:
        mode: DISABLE
EOF
```

1. The port value in the peer authentication policy is the container's port. The value the destination rule is the service's port.
1. You can only use `portLevelMtls` if the port is bound to a service. Istio ignores it otherwise.

```
for from in "foo" "bar" "legacy"; do for to in "foo" "bar" "legacy"; do kubectl exec "$(kubectl get pod -l app=sleep -n ${from} -o jsonpath={.items..metadata.name})" -c sleep -n ${from} -- curl "http://httpbin.${to}:8000/ip" -s -o /dev/null -w "sleep.${from} to httpbin.${to}: %{http_code}\n"; done; done
```

Output:
```
sleep.foo to httpbin.foo: 200
sleep.foo to httpbin.bar: 200
sleep.foo to httpbin.legacy: 200
sleep.bar to httpbin.foo: 200
sleep.bar to httpbin.bar: 200
sleep.bar to httpbin.legacy: 200
sleep.legacy to httpbin.foo: 000
command terminated with exit code 56
sleep.legacy to httpbin.bar: 200
sleep.legacy to httpbin.legacy: 200
```

### Policy precedence

A workload-specific peer authentication policy takes precedence over a namespace-wide policy. You can test this behavior if you add a policy to disable mutual TLS for the `httpbin.foo` workload, for example.
Note that you've already created a namespace-wide policy that enables mutual TLS for all services in namespace `foo` and observe that requests from
`sleep.legacy` to `httpbin.foo` are failing (see above).

```
cat <<EOF | kubectl apply -n foo -f -
apiVersion: "security.istio.io/v1beta1"
kind: "PeerAuthentication"
metadata:
  name: "overwrite-example"
  namespace: "foo"
spec:
  selector:
    matchLabels:
      app: httpbin
  mtls:
    mode: DISABLE
EOF
```
and destination rule:

```
cat <<EOF | kubectl apply -n foo -f -
apiVersion: "networking.istio.io/v1alpha3"
kind: "DestinationRule"
metadata:
  name: "overwrite-example"
spec:
  host: httpbin.foo.svc.cluster.local
  trafficPolicy:
    tls:
      mode: DISABLE
EOF
```

Re-running the request from `sleep.legacy`, you should see a success return code again (200), confirming service-specific policy overrides the namespace-wide policy.

```
kubectl exec "$(kubectl get pod -l app=sleep -n legacy -o jsonpath={.items..metadata.name})" -c sleep -n legacy -- curl http://httpbin.foo:8000/ip -s -o /dev/null -w "%{http_code}\n"
```

Output:
```
200
```

### Cleanup part 2

Remove policies and destination rules created in the above steps:

```
kubectl delete peerauthentication default overwrite-example -n foo
kubectl delete peerauthentication httpbin -n bar
kubectl delete destinationrules overwrite-example -n foo
kubectl delete destinationrules httpbin -n bar
```

## Authorization for HTTP traffic
This task shows you how to set up Istio authorization for HTTP traffic in an Istio mesh.

## Configure access control for workloads using HTTP traffic

Using Istio, you can easily setup access control for workloads in your mesh. This task shows you how to set up access control using Istio authorization.

First, you configure a simple `deny-all` policy that rejects all requests to the workload, and then grant more access to the workload gradually and incrementally.

1. Run the following command to create a `deny-all` policy in the `default` namespace. The policy doesn't have a `selector` field, which applies the policy to every workload in the `default` namespace. The `spec:` field of the policy has the empty value `{}`. That value means that no traffic is permitted, effectively denying all requests.

```
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: deny-all
  namespace: default
spec:
  {}
EOF
```

Point your browser at the Bookinfo `productpage` (`http://$GATEWAY_URL/productpage`). You should see `"RBAC: access denied"`. The error shows that the configured `deny-all` policy is working as intended, and Istio doesn't have any rules that allow any access to workloads in the mesh.

1. Run the following command to create a `productpage-viewer` policy to allow access
   with `GET` method to the `productpage` workload. The policy does not set the `from` field in the `rules` which means all sources are allowed, effectively allowing all users and workloads:

```
kubectl apply -f - <<EOF
apiVersion: "security.istio.io/v1beta1"
kind: "AuthorizationPolicy"
metadata:
  name: "productpage-viewer"
  namespace: default
spec:
  selector:
    matchLabels:
      app: productpage
  rules:
  - to:
    - operation:
        methods: ["GET"]
EOF
```

Point your browser at the Bookinfo `productpage` (`http://$GATEWAY_URL/productpage`).
Now you should see the "Bookinfo Sample" page.

However, you can see the following errors on the page:

* `Error fetching product details`
* `Error fetching product reviews` on the page.

These errors are expected because we have not granted the `productpage`
workload access to the `details` and `reviews` workloads. Next, you need to
configure a policy to grant access to those workloads.

1. Run the following command to create the `details-viewer` policy to allow the `productpage` workload, which issues requests using the `cluster.local/ns/default/sa/bookinfo-productpage` service account, to access the `details` workload through `GET` methods:

```
kubectl apply -f - <<EOF
apiVersion: "security.istio.io/v1beta1"
kind: "AuthorizationPolicy"
metadata:
  name: "details-viewer"
  namespace: default
spec:
  selector:
    matchLabels:
      app: details
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/default/sa/bookinfo-productpage"]
    to:
    - operation:
        methods: ["GET"]
EOF
```

1. Run the following command to create a policy `reviews-viewer` to allow the `productpage` workload, which issues requests using the `cluster.local/ns/default/sa/bookinfo-productpage` service account, to access the `reviews` workload through `GET` methods:

```
kubectl apply -f - <<EOF
apiVersion: "security.istio.io/v1beta1"
kind: "AuthorizationPolicy"
metadata:
  name: "reviews-viewer"
  namespace: default
spec:
  selector:
    matchLabels:
      app: reviews
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/default/sa/bookinfo-productpage"]
    to:
    - operation:
        methods: ["GET"]
EOF
```
  
Point your browser at the Bookinfo `productpage` (`http://$GATEWAY_URL/productpage`). Now, you should see the "Bookinfo Sample" page with "Book Details" on the lower left part, and "Book Reviews" on the lower right part. However, in the "Book Reviews" section, there is an error `Ratings service currently unavailable`.

This is because the `reviews` workload doesn't have permission to access the `ratings` workload.
To fix this issue, you need to grant the `reviews` workload access to the `ratings` workload. Next, we configure a policy to grant the `reviews` workload that access.

1. Run the following command to create the `ratings-viewer` policy to allow the `reviews` workload, which issues requests using the `cluster.local/ns/default/sa/bookinfo-reviews` service account, to access the `ratings` workload through `GET` methods:

```
kubectl apply -f - <<EOF
apiVersion: "security.istio.io/v1beta1"
kind: "AuthorizationPolicy"
metadata:
  name: "ratings-viewer"
  namespace: default
spec:
  selector:
    matchLabels:
      app: ratings
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/default/sa/bookinfo-reviews"]
    to:
    - operation:
        methods: ["GET"]
EOF
```
  
Point your browser at the Bookinfo `productpage` (`http://$GATEWAY_URL/productpage`).
You should see the "black" and "red" ratings in the "Book Reviews" section.

**Congratulations!** You successfully applied authorization policy to enforce access
control for workloads using HTTP traffic.

## Clean up

1. Remove all authorization policies from your configuration:

```
kubectl delete authorizationpolicy.security.istio.io/deny-all
kubectl delete authorizationpolicy.security.istio.io/productpage-viewer
kubectl delete authorizationpolicy.security.istio.io/details-viewer
kubectl delete authorizationpolicy.security.istio.io/reviews-viewer
kubectl delete authorizationpolicy.security.istio.io/ratings-viewer
```