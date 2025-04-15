FROM node:18.2

RUN apt-get update && \
    apt-get install -y openjdk-17-jdk git && \
    apt-get clean;

RUN wget https://downloads.apache.org/maven/maven-3/3.9.4/binaries/apache-maven-3.9.4-bin.tar.gz && \
    tar xzvf apache-maven-3.9.4-bin.tar.gz -C /opt && \
    ln -s /opt/apache-maven-3.9.4 /opt/maven && \
    rm apache-maven-3.9.4-bin.tar.gz

ENV JAVA_HOME /usr/lib/jvm/java-17-openjdk-amd64
ENV PATH $JAVA_HOME/bin:/opt/maven/bin:$PATH

WORKDIR /app

COPY . .

# Initialize and update Git submodules
RUN git submodule update --init --recursive
 
RUN cd /app/services/dms/repo/extremexp-dsl-framework && git checkout 19d81e568ce9c1d13bc06a0a965a2a7298199344
RUN cd /app/services/dms/repo/eu.extremexp.dms && git checkout bd3865b684bb7cf8fa48da7532b56eabfdc1f4bb
RUN cd /app/services/dms/repo/ && make

COPY ./server/config ./config

RUN cd server && npm install
RUN cd server && npm install express-ws

RUN cd client && npm install

RUN cd ivis-core && git checkout extremeXP
RUN cd ivis-core/server && npm install
RUN cd ivis-core/client && npm install
RUN cd ivis-core/shared && npm install

RUN cd client && npm run build

RUN chmod +x /app/ivis-core/server/certs/test/setup.sh

RUN cd /app/ivis-core/server/certs/test && ./setup.sh

COPY wait-for-it.sh /usr/local/bin/wait-for-it.sh
RUN chmod +x /usr/local/bin/wait-for-it.sh

EXPOSE 8443 8444 8445
