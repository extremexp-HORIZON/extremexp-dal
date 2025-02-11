# ExtremeXP IVIS Wrapper

This project is set up using Docker and Docker Compose to create a development environment for the `expvis` application. The environment includes services for MariaDB, Redis, and Elasticsearch, as well as a custom Node.js application with various dependencies.

## Prerequisites

- Docker
- Docker Compose

## Project Structure

- **Dockerfile**: Sets up a Node.js environment with OpenJDK 17, Maven 3.9.4, and Git. It also installs necessary npm packages and prepares the application for development.
- **docker-compose.yml**: Defines the services required for the project, including MariaDB, Redis, Elasticsearch, and the `expvis` application.

## Setup Instructions

*Note that these are the setup instructions for running `expvis` in Docker. For installation on your local machine (for development), follow the [instructions in `ivis-core`](https://github.com/smartarch/ivis-core/wiki/Local-installation-for-development).*

1. **Clone the Repository:**

   ```bash
   git clone --recurse-submodules <repository_url>
   cd <repository_directory>
   ```

2. **Configure Git Credentials:**

   The Dockerfile requires Git credentials to initialize and update submodules. Follow these steps to securely store and use your credentials:

   - **Store your Git credentials**:

     Run the following command to store your Git credentials:

     ```bash
     git config --global credential.helper store
     ```

     Next, execute any Git command that requires authentication (e.g., `git pull`). You will be prompted for your username and password, which will be stored in `~/.git-credentials`.

   - **Retrieve and set the `GIT_CREDENTIALS` environment variable**:

     Open the `~/.git-credentials` file to view your stored credentials:

     ```bash
     cat ~/.git-credentials
     ```

     You should see a line similar to:

     ```
     https://username:password@colab-repo.intracom-telecom.com
     ```

     Copy this line and set it as the `GIT_CREDENTIALS` environment variable:

     ```bash
     export GIT_CREDENTIALS="https://username:password@colab-repo.intracom-telecom.com"
     ```



   - **Update the Dockerfile**:

     Ensure that the Dockerfile uses the `GIT_CREDENTIALS` environment variable:

     ```dockerfile
     RUN git config --global credential.helper store && \
         echo "${GIT_CREDENTIALS}" > ~/.git-credentials && \
         git submodule update --init --recursive --remote
     ```

     **NOTE** if the above method did not work, write the credentials directly in the Docker file.

     ```dockerfile
     RUN git config --global credential.helper store && \
         echo "https://username:password@colab-repo.intracom-telecom.com" > ~/.git-credentials && \
         git submodule update --init --recursive --remote
     ```

3. **Update Configuration:**

   By default, the app is set to run on localhost on HTTP (via Docker). If you want to access it via a different URL and use HTTPS, create the `server/config/development.yaml` file and set the URL configuration:

   ```yaml
   www:
     trustedPortIsHttps: true
     sandboxPortIsHttps: true
     apiPortIsHttps: true
   
     trustedUrlBase: https://expvis.smartarch.cz
     sandboxUrlBase: https://sbox.expvis.smartarch.cz
   ```
   
   Possibly also update other configuration (e.g., `mysql.password`). See [`server/config/default.yaml`](server/config/default.yaml) for default values.

4. **Build the Docker Images:**

   ```bash
   docker-compose build
   ```

5. **Start the Services:**

   ```bash
   docker-compose up
   ```

   This will start the following services:
   - **MariaDB** on port `3305`
   - **Redis** on port `6380`
   - **Elasticsearch** on ports `9200` and `9300`
   - **expvis Application** on ports `8443`, `8444`, and `8445`

6. **Access the Application:**

   Once all services are up and running, you can access the ExpVis application via:

   - [https://localhost:8443](https://localhost:8443)
   - [https://localhost:8444](https://localhost:8444)
   - [https://localhost:8445](https://localhost:8445)

## Additional Information

- The Dockerfile installs OpenJDK 17 and Maven 3.9.4 to support Java-based components of the application.
- Submodules are initialized and updated to ensure that all dependencies are properly fetched.
- The `wait-for-it.sh` script is used to ensure that dependent services (MariaDB, Elasticsearch) are available before starting the application.
- Custom setup scripts and configurations are copied and executed as needed.

## Environment Variables

The following environment variables are set in the `docker-compose.yml`:

- **NODE_ENV**: `development`
- **MYSQL_USER**: `expvis`
- **MYSQL_PASSWORD**: `expvis`
- **MYSQL_DATABASE**: `expvis`
- **MYSQL_HOST**: `expvis-mariadb-1`
- **REDIS_HOST**: `expvis-redis-1`
- **ELASTICSEARCH_HOST**: `http://elasticsearch:9200`
- **DMS_PATH**: `/app/services/dms`

## Volumes

The following volumes are used to persist data:

- **mariadb_data**: Stores MariaDB data
- **redis_data**: Stores Redis data
- **elasticsearch_data**: Stores Elasticsearch data

## Notes

- Ensure that the Git credentials are properly set in the environment to allow submodule updates.
- The application uses a specific branch (`extremeXP`) for the `ivis-core` repository.


# Deployed server
for the documentation check:
https://documenter.getpostman.com/view/37096355/2sA3sAio7d
