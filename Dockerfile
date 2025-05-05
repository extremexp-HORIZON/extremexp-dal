FROM node:18.2

# Update package list and install necessary packages
RUN apt-get update && \
    apt-get install -y wget tar && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set environment variables for Java installation
ENV JAVA_VERSION=17.0.12
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="$JAVA_HOME/bin:$PATH"

# Download and extract OpenJDK 17
RUN mkdir -p $JAVA_HOME && \
    wget -q https://download.oracle.com/java/17/archive/jdk-${JAVA_VERSION}_linux-x64_bin.tar.gz -O /tmp/openjdk.tar.gz && \
    tar -xzf /tmp/openjdk.tar.gz -C $JAVA_HOME --strip-components=1 && \
    rm /tmp/openjdk.tar.gz


RUN apt-get update && \
    apt-get install -y git && \
    apt-get clean;

RUN wget https://downloads.apache.org/maven/maven-3/3.9.4/binaries/apache-maven-3.9.4-bin.tar.gz && \
    tar xzvf apache-maven-3.9.4-bin.tar.gz -C /opt && \
    ln -s /opt/apache-maven-3.9.4 /opt/maven && \
    rm apache-maven-3.9.4-bin.tar.gz

#ENV JAVA_HOME /usr/lib/jvm/java-17-openjdk-amd64
ENV PATH $JAVA_HOME/bin:/opt/maven/bin:$PATH

WORKDIR /app

COPY . .

# Initialize and update Git submodules

RUN git submodule update --init --recursive 

 
#RUN cd /app/services/dms/repo/extremexp-dsl-framework && git checkout 19d81e568ce9c1d13bc06a0a965a2a7298199344
#RUN cd /app/services/dms/repo/eu.extremexp.dms && git checkout bd3865b684bb7cf8fa48da7532b56eabfdc1f4bb
RUN cd /app/services/dms/repo/ && make

COPY ./server/config ./config

RUN cd server && npm install
RUN cd server && npm install express-ws

RUN cd client && npm install

#RUN cd ivis-core && git checkout extremeXP
RUN cd ivis-core/server && npm install
RUN cd ivis-core/client && npm install
RUN cd ivis-core/shared && npm install

RUN cd client && npm run build

RUN chmod +x /app/ivis-core/server/certs/test/setup.sh

RUN cd /app/ivis-core/server/certs/test && ./setup.sh

COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
RUN chmod +x /usr/local/bin/wait-for-it.sh

EXPOSE 8443 8444 8445
