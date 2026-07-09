lint:
	@prettier --write "src/**/*.ts"

# --- Production (default): builds the multi-stage image, runs compiled dist/, no source bind-mounts ---
up-with-logs:
	sudo docker compose -f docker-compose.yml --env-file .env down
	sudo docker compose -f docker-compose.yml --env-file .env up --build -d
	sudo docker compose -f docker-compose.yml --env-file .env logs -f server-api
	sudo docker image prune -f

up:
	sudo docker compose -f docker-compose.yml --env-file .env down
	sudo docker compose -f docker-compose.yml --env-file .env up --build -d
	sudo docker image prune -f

down:
	sudo docker compose -f docker-compose.yml --env-file .env down
	sudo docker image prune -f

# --- Development: nodemon/ts-node hot-reload, source bind-mounted ---
up-dev:
	sudo docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env down
	sudo docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env up --build
	sudo docker image prune -f

down-dev:
	sudo docker compose -f docker-compose.yml -f docker-compose.dev.yml --env-file .env down
	sudo docker image prune -f