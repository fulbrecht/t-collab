# T-Collab: Collaborative T-Account Ledger

T-Collab is a real-time, collaborative T-account ledger application built with Node.js, Express, Socket.IO, and D3.js. It allows multiple users to work together on T-accounts and transactions in real-time, with all changes synchronized across connected clients.

## Features

*   **Real-time Collaboration:** All changes to T-accounts and transactions are instantly synchronized.
*   **T-Account Management:** Create, rename, delete, and drag T-accounts.
*   **Transaction Management:** Add, delete, edit, and toggle the active state of transactions. Supports both balanced and unbalanced transactions.
*   **Session Management:** Supports multiple independent ledger sessions.
*   **State Import/Export:** Import and export session data.

## Local Development

To run the application locally:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/fulbrecht/t-collab.git
    cd t-collab
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the server:**
    ```bash
    npm start
    ```
    The application will be available at `http://localhost:3000`.

## Deployment with Docker and GitHub Container Registry (GHCR)

This project is set up for deployment using Docker and GitHub Actions to build and push multi-architecture Docker images to `ghcr.io`.

### Prerequisites

*   Docker installed on your deployment server.
*   Access to your GitHub repository.

### GitHub Actions Workflow

The `.github/workflows/docker-image.yml` workflow automatically builds and pushes Docker images to `ghcr.io` on every push to the `main` branch. It builds images for `linux/amd64` and `linux/arm64` architectures.

### Deploying to your VPS

1.  **Ensure Docker is installed on your VPS.**

2.  **Log in to GitHub Container Registry on your VPS:**
    ```bash
    echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
    ```
    Replace `YOUR_GITHUB_TOKEN` with a [GitHub Personal Access Token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) that has `read:packages` scope, and `YOUR_GITHUB_USERNAME` with your GitHub username.

3.  **Pull and run the Docker image:**
    ```bash
    docker pull ghcr.io/fulbrecht/t-collab:latest
    docker run -d -p 3000:3000 --name t-collab ghcr.io/fulbrecht/t-collab:latest
    ```
    The application will be accessible on your VPS at `http://YOUR_VPS_IP_ADDRESS:3000`.

### Using Docker Compose (on your VPS)

Alternatively, you can use `docker-compose` to run the application:

1.  **Ensure Docker and Docker Compose are installed on your VPS.**

2.  **Create a `docker-compose.yml` file on your VPS** (or copy the one from this repository):
    ```yaml
    version: '3.8'
    services:
      app:
        image: ghcr.io/fulbrecht/t-collab:latest
        ports:
          - "3000:3000"
        environment:
          - NODE_ENV=production
    ```

3.  **Log in to GitHub Container Registry on your VPS** (same as step 2 above).

4.  **Run with Docker Compose:**
    ```bash
    docker-compose up -d
    ```
    The application will be accessible on your VPS at `http://YOUR_VPS_IP_ADDRESS:3000`.
