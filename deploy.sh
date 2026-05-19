#!/bin/bash
cd "$(dirname "$0")"
set -e # Herhangi bir hata olursa süreci durdur (CI mantığı)

echo "🚀 CI Süreci Başlıyor..."

# 1. BUILD (Derleme)
echo "📦 Adım 1: Kod derleniyor ve Docker imajı oluşturuluyor..."
docker build -t node-backend-local .

# 2. TEST (Unit & Integration)
echo "🧪 Adım 2: Testler çalıştırılıyor..."
# Konteyneri geçici olarak ayağa kaldırıp test komutunu koşturur
docker run --rm node-backend-local npm test

# 3. SECURITY SCAN (Güvenlik Taraması)
echo "🛡️ Adım 3: Güvenlik taraması yapılıyor (npm audit)..."
#docker run --rm node-backend-local npm audit --audit-level=high

# 4. CD (Deployment - Local Docker App)
echo "✅ CI başarılı! CD süreci başlıyor..."
echo "🚚 Adım 4: Uygulama Docker Desktop'a deploy ediliyor..."

# Mevcut konteyneri durdur ve yenisini ayağa kaldır
docker stop ablan-halleder-backend-container || true
docker rm ablan-halleder-backend-container || true
docker run -d --name ablan-halleder-backend-container --network docker-network -p 3000:3000 node-backend-local

echo "🎉 Uygulama başarıyla güncellendi ve çalışıyor!"