lint:
	@prettier --write "src/**/*.ts"

up-with-logs:
	sudo docker compose -f docker-compose.yml --env-file .env down
	sudo docker compose -f docker-compose.yml --env-file .env up --build -d
	sudo docker compose -f docker-compose.yml --env-file .env logs -f server-api
	sudo docker image prune -f

up:
	sudo docker compose -f docker-compose.yml --env-file .env down
	sudo docker compose -f docker-compose.yml --env-file .env up --build
	sudo docker image prune -f

down:
	sudo docker compose -f docker-compose.yml --env-file .env down
	sudo docker image prune -f