# Build Docker Images

Let’s walk through manually containerizing our applications.   In this lab we will build a few `Dockerfile`s which can be used as examples of how to containerize Java applications. 

## Oracle Java Dockerfile
Start by creating a working directory. 
```
mkdir oracle-jdk 
cd oracle-jdk 
```

Now in this directory we will create a `Dockerfile` to install Oracle Java. 

Add the following to the top of the `Dockerfile` to specify the base image as Phusion (a very lightweight Ubuntu bistro)
```
FROM phusion/baseimage:0.9.17
```

Continue by adding a section to update package repository and install some Python packages. 
```
RUN echo "deb http://archive.ubuntu.com/ubuntu trusty main universe" > /etc/apt/sources.list

RUN apt-get -y update

RUN DEBIAN_FRONTEND=noninteractive apt-get install -y -q python-software-properties software-properties-common
```

Now we are going to install install Oracle Java, add the following to your `Dockerfile`
```
ENV JAVA_VER 8
ENV JAVA_HOME /usr/lib/jvm/java-8-oracle

RUN echo 'deb http://ppa.launchpad.net/webupd8team/java/ubuntu trusty main' >> /etc/apt/sources.list && \
    echo 'deb-src http://ppa.launchpad.net/webupd8team/java/ubuntu trusty main' >> /etc/apt/sources.list && \
    apt-key adv --keyserver keyserver.ubuntu.com --recv-keys C2518248EEA14886 && \
    apt-get update && \
    echo oracle-java${JAVA_VER}-installer shared/accepted-oracle-license-v1-1 select true | sudo /usr/bin/debconf-set-selections && \
    apt-get install -y --force-yes --no-install-recommends oracle-java${JAVA_VER}-installer oracle-java${JAVA_VER}-set-default && \
    apt-get clean && \
    rm -rf /var/cache/oracle-jdk${JAVA_VER}-installer
```

Now we need to add a section to set our newly installed Java as the default 
```
RUN update-java-alternatives -s java-8-oracle

RUN echo "export JAVA_HOME=/usr/lib/jvm/java-8-oracle" >> ~/.bashrc
```

An important thing to remember when building Docker images is we want to keep them as small as possible.  To do this we need to remove things like our package cache.  
Add the following to clean up temporary files that are no longer needed.
```
RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*
```

Now use the base images init system to start our process. 
```
CMD ["/sbin/my_init"]
```

Now let's go ahead and build our Docker image. 
```
docker build -t demo/oracle-java:8 .
```

If everything built successfully we need to test it, so let's do that now. 

Create a project directory called app
```
mkdir app 
```

Inside of the `app` directory create a `Main.java` file with the following hello world code.
```
public class Main
{
     public static void main(String[] args) {
        System.out.println("Hello, World");
    }
}
``` 

Now execute the following to compile the app.
```
docker run --rm -v $PWD/app:/app -w /app demo/oracle-java:8 javac Main.java
```

To run the compiled application run:
```
docker run --rm -v $PWD/app:/app -w /app demo/oracle-java:8 java Main
```

## Build Maven app 

Now that we've built an Oracle Java Docker image we can build an image for our specific application. 

Start by creating a file named `Dockerfile-maven`with the following
```
FROM demo/oracle-java:8

ENV MAVEN_VERSION 3.3.9

RUN mkdir -p /usr/share/maven \
  && curl -fsSL http://apache.osuosl.org/maven/maven-3/$MAVEN_VERSION/binaries/apache-maven-$MAVEN_VERSION-bin.tar.gz \
    | tar -xzC /usr/share/maven --strip-components=1 \
  && ln -s /usr/share/maven/bin/mvn /usr/bin/mvn

ENV MAVEN_HOME /usr/share/maven

VOLUME /root/.m2

CMD ["mvn"] 
```

In this Dockerfile we have used the command `VOLUME`. This command is used to expose to the host machine the volume from the container. We can map this volume to any host directory.

Now build the Docker image.
```
docker build -f Dockerfile-maven -t demo/maven:3.3-jdk-8 .
```

Now we are going to run a test application. We need to create a Maven project to start with, 

Enter the `app` directory
```
cd app
```

Run the following command and just hit enter when prompted.
```
docker run -it --rm -v "$PWD":/app -w /app demo/maven:3.3-jdk-8 mvn archetype:generate -DgroupId=com.mycompany.app -DartifactId=my-app -DarchetypeArtifactId=maven-archetype-quickstart -Dinte
```

Now we are going to build the project and test the `JAR` file. 

Build the project
```
docker run -it --rm -v "$PWD"/my-app:/app -w /app demo/maven:3.3-jdk-8 mvn package
```

If that is successful go ahead and run the app! 

```
docker run -it --rm -v "$PWD"/my-app:/app -w /app demo/maven:3.3-jdk-8 java -cp target/my-app-1.0-SNAPSHOT.jar com.mycompany.app.App
```

You should now see a successful "Hello World!" message. 

In this lab you successfully built a couple of Docker images and executed applications using those images. 

# Lab Complete