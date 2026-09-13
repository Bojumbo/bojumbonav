# ?? TruckNav PWA — HGV Truck Navigator

Сучасний PWA веб-навігатор для вантажних автомобілів (HGV) з підтримкою габаритних обмежень, ваги, висоти, знаків обмеження швидкості та об'їзду заборонних знаків.

---

## ??? Технологічний стек
- **Frontend**: React 19, Vite 8, TailwindCSS v4
- **Картографія**: MapLibre GL JS, OpenStreetMap tiles
- **Вантажна Маршрутизація**: OpenRouteService HGV API + OSRM Fallback
- **Знаки та Обмеження**: OSM Overpass API + ORS speed limits extras
- **Деплой**: Docker (Multi-stage Nginx Alpine), Portainer, Cloudflare Zero Trust Tunnel

---

## ?? Крок 1: Пуш проєкту на GitHub

Якщо репозиторій ще не ініціалізовано, виконайте у терміналі проєкту:

```bash
git init
git add .
git commit -m "feat: complete TruckNav PWA with multi-waypoint, speed limits and docker deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/bojumbonav.git
git push -u origin main
```

---

## ?? Крок 2: Розгортання у Portainer (Docker)

### Варіант А: Через Portainer Stacks (Рекомендовано)
1. Відкрийте **Portainer** -> **Stacks** -> **Add stack**.
2. Вкажіть Назву: `trucknav`.
3. Оберіть **Build method: Repository** та вкажіть URL вашого GitHub репозиторію (`https://github.com/YOUR_USERNAME/bojumbonav`).
4. Натисніть **Deploy the stack**. Portainer сам збере Docker-образ і запустить контейнер.

### Варіант Б: Локальна збірка через Docker CLI
```bash
docker compose up -d --build
```
Контейнер буде доступний на локальному порту **`http://localhost:3000`** (або порту вашого сервера).

---

## ?? Крок 3: Прокидання на домен через Cloudflare Zero Trust Tunnel

1. Відкрийте [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) -> **Networks** -> **Tunnels**.
2. Створіть новий тунель (наприклад: `trucknav-tunnel`).
3. Встановіть `cloudflared` на вашому сервері/сервері Portainer за наданою командою.
4. У вкладці **Public Hostname** додайте нове правило:
   - **Subdomain / Domain**: `truck.yourdomain.com` (або власний домен)
   - **Type**: `HTTP`
   - **URL**: `trucknav:80` (якщо контейнер у спільній Docker-мережі з тунелем) **або** `http://172.17.0.1:3000` (IP вашого сервера та порт 3000).
5. Збережіть правило. Cloudflare автоматично випустить безкоштовний **SSL (HTTPS)** сертифікат, і ваш додаток буде миттєво доступний за захищеною адресою `https://truck.yourdomain.com`!

---

## ?? PWA Встановлення
Після відкриття сайту на смартфоні чи планшеті натисніть **"Додати на головний екран"** (Add to Home Screen), щоб завантажити TruckNav як автономний мобільний додаток.
