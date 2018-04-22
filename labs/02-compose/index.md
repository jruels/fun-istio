# Package Microservices
In the following lab we will take a microservice application and package it into Docker containers using a `Dockerfile` and `docker-compose`

## Prepare the Environment
This section uses `Dockerfiles` to configure Docker images.

Create a directory for the microservices
```
mkdir flask-microservice
```

Create the directory structure 
```
cd flask-microservice
mkdir nginx postgres web
```

### NGINX
Within the new `nginx` subdirectory, create a Dockerfile for the NGINX image:
```
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
```

Now we need to create our configuration in file `nginx/nginx.conf` with the following:
```
user  nginx;
worker_processes 1;
error_log  /dev/stdout info;
error_log off;
pid        /var/run/nginx.pid;

events {
    worker_connections  1024;
    use epoll;
    multi_accept on;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /dev/stdout main;
    access_log off;
    keepalive_timeout 65;
    keepalive_requests 100000;
    tcp_nopush on;
    tcp_nodelay on;

    server {
        listen 80;
        proxy_pass_header Server;

        location / {
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;

            # app comes from /etc/hosts, Docker added it for us!
            proxy_pass http://flaskapp:8000/;
        }
    }
}
```

### PostgreSQL
For this service we will use the official postgresql image on Docker Hub, so no Dockerfile is necessary.

Create   `postgres/init.sql` file with following 
```
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;
CREATE EXTENSION IF NOT EXISTS plpgsql WITH SCHEMA pg_catalog;
COMMENT ON EXTENSION plpgsql IS 'PL/pgSQL procedural language';
SET search_path = public, pg_catalog;
SET default_tablespace = '';
SET default_with_oids = false;
CREATE TABLE visitors (
    site_id integer,
    site_name text,
    visitor_count integer
);

ALTER TABLE visitors OWNER TO postgres;
COPY visitors (site_id, site_name, visitor_count) FROM stdin;
1 	linodeexample.com  	0
\.
```

### Web
The web image will hold an example Flask app. Add the following files to the web directory to prepare the app:

Create a Python version file to specify we want Python 3.6
```
echo "3.6.0" >> web/.python-version
```

Create a `Dockerfile	`  in the web directory 
```
FROM python:3.6.2-slim
RUN groupadd flaskgroup && useradd -m -g flaskgroup -s /bin/bash flask
RUN echo "flask ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
RUN mkdir -p /home/flask/app/web
WORKDIR /home/flask/app/web
COPY requirements.txt /home/flask/app/web
RUN pip install --no-cache-dir -r requirements.txt
RUN chown -R flask:flaskgroup /home/flask
USER flask
ENTRYPOINT ["/usr/local/bin/gunicorn", "--bind", ":8000", "linode:app", "--reload", "--workers", "16"]
```

Create `web/linode.py` and add the example app script:
```
from flask import Flask
import logging
import psycopg2
import redis
import sys

app = Flask(__name__)
cache = redis.StrictRedis(host='redis', port=6379)

# Configure Logging
app.logger.addHandler(logging.StreamHandler(sys.stdout))
app.logger.setLevel(logging.DEBUG)

def PgFetch(query, method):

    # Connect to an existing database
    conn = psycopg2.connect("host='postgres' dbname='linode' user='postgres' password='linode123'")

    # Open a cursor to perform database operations
    cur = conn.cursor()

    # Query the database and obtain data as Python objects
    dbquery = cur.execute(query)

    if method == 'GET':
        result = cur.fetchone()
    else:
        result = ""

    # Make the changes to the database persistent
    conn.commit()

    # Close communication with the database
    cur.close()
    conn.close()
    return result

@app.route('/')
def hello_world():
    if cache.exists('visitor_count'):
        cache.incr('visitor_count')
        count = (cache.get('visitor_count')).decode('utf-8')
        update = PgFetch("UPDATE visitors set visitor_count = " + count + " where site_id = 1;", "POST")
    else:
        cache_refresh = PgFetch("SELECT visitor_count FROM visitors where site_id = 1;", "GET")
        count = int(cache_refresh[0])
        cache.set('visitor_count', count)
        cache.incr('visitor_count')
        count = (cache.get('visitor_count')).decode('utf-8')
    return 'Hello Linode!  This page has been viewed %s time(s).' % count

@app.route('/resetcounter')
def resetcounter():
    cache.delete('visitor_count')
    PgFetch("UPDATE visitors set visitor_count = 0 where site_id = 1;", "POST")
    app.logger.debug("reset visitor count")
    return "Successfully deleted redis and postgres counters"
```

Create a  `web/requirements.txt` file with following
```
flask
gunicorn
psycopg2
redis
```

## Docker Compose 
Docker Compose will be used to be define the connections between containers and their configuration settings.

Create a `docker-compose.yml` file in the `flask-microservice` directory and add the following:
```
version: '3'
services:
 # Define the Flask web application
 flaskapp:

   # Build the Dockerfile that is in the web directory
   build: ./web

   # Always restart the container regardless of the exit status; try and restart the container indefinitely
   restart: always

   # Expose port 8000 to other containers (not to the host of the machine)
   expose:
     - "8000"

   # Mount the web directory within the container at /home/flask/app/web
   volumes:
     - ./web:/home/flask/app/web

   # Don't create this container until the redis and postgres containers (below) have been created
   depends_on:
     - redis
     - postgres

   # Link the redis and postgres containers together so that they can talk to one another
   links:
     - redis
     - postgres

   # Pass environment variables to the flask container (this debug level lets you see more useful information)
   environment:
     FLASK_DEBUG: 1

   # Deploy with 3 replicas in the case of failure of one of the containers (only in Docker Swarm)
  # deploy:
  #   mode: replicated
  #   replicas: 3

 # Define the redis Docker container
 redis:

   # use the redis:alpine image: https://hub.docker.com/_/redis/
   image: redis:alpine
   restart: always
 #  deploy:
 #    mode: replicated
 #    replicas: 3

 # Define the redis NGINX forward proxy container
 nginx:

   # build the nginx Dockerfile: http://bit.ly/2kuYaIv
   build: nginx/
   restart: always

   # Expose port 80 to the host machine
   ports:
     - "80:80"
 #  deploy:
 #    mode: replicated
 #    replicas: 3

   # The Flask application needs to be available for NGINX to make successful proxy requests
   depends_on:
     - flaskapp

 # Define the postgres database
 postgres:
   restart: always
   # Use the postgres alpine image: https://hub.docker.com/_/postgres/
   image: postgres:alpine

   # Mount an initialization script and the persistent postgresql data volume
   volumes:
     - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
     - ./postgres/data:/var/lib/postgresql/data

   # Pass postgres environment variables
   environment:
     POSTGRES_PASSWORD: linode123
     POSTGRES_DB: linode

   # Expose port 5432 to other Docker containers
   expose:
     - "5432"
```

## Launch application 
Use Docker Compose to build all of the images and start the microservices:
```
docker-compose up -d
```

You should see all of the services start up

Let’s confirm the application is responding 
```
curl localhost
```


```
Hello Linode! This page has been viewed 1 time(s).
```

Now curl the endpoint a few times to increment the counter.
After the counter has increased run the following to reset the page hit counter.

```
curl localhost/resetcounter
```

```
Successfully deleted redis and postgres counters 
```

Look at service logs to confirm 
```
docker-compose logs flaskapp
```

You should see something like this 
```
flaskapp_1 | DEBUG in linode [/home/flask/app/web/linode.py:56]: flaskapp_1 | reset visitor count
```

In this lab you used Docker Compose to simplify building multiple services and linking then together. 

# Lab Complete
