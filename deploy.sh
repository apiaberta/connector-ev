#!/bin/bash
set -e

echo "🚀 Deploying connector-ev to production..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
  echo "❌ Error: Must run from connector-ev directory"
  exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Start with PM2
echo "🔄 Starting with PM2..."
pm2 start ecosystem.config.cjs

# Save PM2 state
pm2 save

# Show status
echo "✅ Deployment complete!"
echo ""
pm2 status

echo ""
echo "📊 Logs:"
pm2 logs apiaberta-ev --lines 20 --nostream

echo ""
echo "🧹 Cleaning up node_modules to save disk space..."
rm -rf node_modules

echo ""
echo "✅ All done! Service is running on port 3004"
echo "   Health: http://localhost:3004/health"
echo "   Via gateway: http://localhost:4000/v1/ev/tariffs"
