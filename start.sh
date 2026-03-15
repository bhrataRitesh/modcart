# modcart Startup Script
# This script automates infrastructure startup, DB synchronization, and dev server launch.

if [ -f .env ]; then
  export $(cat .env | xargs)
fi

echo "🚀 Starting modcart infrastructure..."
docker-compose up -d

echo "⏳ Waiting for PostgreSQL to be ready..."
# Simple loop to wait for postgres
until docker-compose exec postgres pg_isready -U modcart > /dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo -e "\n✅ PostgreSQL is ready!"

echo "🔄 Syncing database schema..."
pnpm --filter @modcart/db db:push

echo "✨ Starting all services (API, Storefront, Admin, Vendor)..."
pnpm dev
