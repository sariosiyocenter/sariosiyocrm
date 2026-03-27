# Magic deployment command for the root terminal
PROJECT_DIR=$(find / -name "server.js" -exec dirname {} + | grep -v "node_modules" | head -n 1)
if [ -z "$PROJECT_DIR" ]; then
    echo "Proyekt topilmadi! Iltimos, papka nomini tekshiring."
else
    echo "Proyekt topildi: $PROJECT_DIR"
    cd "$PROJECT_DIR"
    git pull origin main
    npm install
    npx prisma generate
    npm run build
    pm2 restart all || node server.js &
    echo "Muvaffaqiyatli yakunlandi! ✅"
fi
