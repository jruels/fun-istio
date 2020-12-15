## Kiali Dashboard
Istio integrates with several different telemetry applications. These can help you gain an understanding of the structure of your service mesh, display the topology of the mesh, and analyze the health of your mesh.

Kiali is a dashboard that provides visibility into your Istio service mesh. 

### Install Isio Addons 
The following command will install Kiali and some additional components for tracing, monitoring and visualization of your applications. 
* Jaeger
* Grafana
* Kiali
* Prometheus

To install the addons run the following: 
```
kubectl apply -f samples/addons
```

Confirm the deployment was successful
```
kubectl rollout status deployment/kiali -n istio-system
```


If there are errors trying to install the addons, try running the command again. There may be some timing issues which will be resolved when the command is run again. 

To open the Kiali UI, execute the following command:   
```
kubectl -n istio-system port-forward $(kubectl -n istio-system get pod -l app=kiali -o jsonpath='{.items[0].metadata.name}') 8080:20001
```

Open your browser by clicking on “Preview on port 8080”:
![Istio](../07-istio1/media/preview.png)

View the overview of your mesh in the Overview page. The Overview page displays all the namespaces that have services in your mesh.
![Istio](../07-istio1/media/kiali-overview-new.png)

In the left navigation menu, select Graph and in the Namespace drop down, select default.

The Kiali dashboard shows an overview of your mesh with the relationships between the services in the Bookinfo sample application. It also provides filters to visualize the traffic flow.
![Istio](../07-istio1/media/kiali-example2.png)

To view a namespace graph, click on the `bookinfo` graph icon in the Bookinfo namespace card. The graph icon is in the lower left of the namespace card and looks like a connected group of circles. The page looks similar to:
![Istio](../07-istio1/media/kiali-graph-new.png)

To view a summary of metrics, select any node or edge in the graph to display its metric details in the summary details panel on the right.

To view your service mesh using different graph types, select a graph type from the Graph Type drop down menu. There are several graph types to choose from: App, Versioned App, Workload, Service.

The App graph type aggregates all versions of an app into a single graph node. The following example shows a single reviews node representing the three versions of the reviews app.
![Istio](../07-istio1/media/kiali-app.png)

The Versioned App graph type shows a node for each version of an app, but all versions of a particular app are grouped together. The following example shows the reviews group box that contains the three nodes that represents the three versions of the reviews app.
![Istio](../07-istio1/media/kiali-versionedapp-new.png)

## Validating Istio configuration 
Kiali can validate your Istio resources to ensure they follow proper conventions and semantics. Any problems detected in the configuration of your Istio resources can be flagged as errors or warnings depending on the severity of the incorrect configuration.

Force an invalid configuration of a service port name to see how Kiali reports a validation error.

1. Change the port name of the details service from http to foo:
```
kubectl patch service details -n bookinfo --type json -p '[{"op":"replace","path":"/spec/ports/0/name", "value":"foo"}]'
```
2. Navigate to the Services list by clicking Services on the left hand navigation bar.
3. Select bookinfo from the Namespace drop down menu if it is not already selected.
4. Notice the error icon displayed in the Configuration column of the details row.
![Istio](../07-istio1/media/kiali-validate1-list.png)
5. Click the details link in the Name column to navigate to the service details view.
6. Hover over the error icon to display a tool tip describing the error.
![Istio](../07-istio1/media/kiali-validate2-errormsg.png)
7. Change the port name back to http to correct the configuration and return bookinfo back to its normal state.
```
kubectl patch service details -n bookinfo --type json -p '[{"op":"replace","path":"/spec/ports/0/name", "value":"http"}]'
```
![Istio](../07-istio1/media/kiali-validate3-ok.png)

## Tracing
Istio integrates with Jaeger to provide Span duration and tracing details. 

To see tracing for troulbeshooting your microservices click on the **Services** tab and select **Metrics Settings**.
![Istio](../07-istio1/media/traces-metrics-thumb-v1.22.0.png)

Users can navigate to the traces tab to browse filtered traces for a given service in the time interval or to show details for a single trace.

The tracing toolbar offers some control over the data to fetch, to facilitate the user experience. In the tracing view, as shown in the image below, it’s possible to select the traces interval, results limit, status code, errors, adjust time (expand results on time), last Xm traffic (Traces from last minutes) and refresh interval.

After selecting a trace, Kiali shows the information related to that trace like number of spans, spans grouped by operation name, duration, date.
![Istio](../07-istio1/media/traces-view-thumb-v1.22.0.png)


