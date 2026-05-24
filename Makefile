.PHONY: up down restart logs ps build migrate seed test concurrency typecheck clean

up:
	docker compose up -d --build
	@echo "Waiting for db to be ready..."
	@sleep 5
	docker compose exec app npm run db:migrate
	@echo "Application is ready"
down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

ps:
	docker compose ps

build:
	docker compose exec app npm run build

migrate:
	docker compose exec app npm run db:migrate

seed:
	docker compose exec app npm run db:seed

test:
	docker compose exec app npm test

concurrency:
	docker compose exec app npm run test:concurrency -- --requests=200 --capacity=10

typecheck:
	docker compose exec app npm run typecheck

clean:
	docker compose down -v
