# AI Smart Parking System
A responsive frontend with a Spring Boot, JWT and MySQL backend.

## Run locally

### Frontend
1. Open the project folder in VS Code.
2. Start `index.html` with the Live Server extension.
3. Keep an internet connection available for Leaflet maps and OpenStreetMap tiles.
4. Open the URL Live Server prints in the terminal. Do not use bare `http://127.0.0.1/`; it points to port 80, not the Live Server port.

### Spring Boot + MySQL backend
1. Start MySQL in XAMPP. This project uses port `3307` because another MySQL service already occupies `3306`; the XAMPP config at `C:\xampp\mysql\bin\my.ini` is set to `3307`. Restart MySQL from XAMPP Control Panel after changing its port. In MySQL Workbench, connect to `127.0.0.1:3307` as the XAMPP administrator and execute `backend/mysql-setup.sql`. It creates the development database and app user `smartpark` with a local-only password; do not use these credentials in production.
2. In a VS Code PowerShell terminal, change to the backend folder, then run the commands below. If the prompt is at `...\Downloads\AI-Smart-Parking-System>`, first use `cd .\AI-Smart-Parking-System\backend`. If it is already at `...\Downloads\AI-Smart-Parking-System\AI-Smart-Parking-System>`, use `cd .\backend`.
   ```powershell
   cd backend
   $env:MYSQL_USERNAME = "smartpark"
   $env:MYSQL_PASSWORD = "smartpark"
   mvn spring-boot:run
   ```
   Keep this terminal open. To use different MySQL credentials, set the environment variables to those values instead.
3. Check `http://localhost:8081/api/health`; it should return `{"status":"UP","service":"smartpark-backend"}`.
4. Open the frontend with Live Server and sign in. The default demo administrator is `admin@smartpark.com` / `admin123`. Change the JWT secret and administrator password for deployment.

The backend uses BCrypt password hashing, JWT bearer authentication, and role authorization for `CUSTOMER`, `OWNER`, and `ADMIN`. Booking slots use transactional updates and JPA optimistic locking. Availability changes are delivered through the `/api/locations/stream` SSE endpoint.

After signing in, use **Live Data** in the dashboard navigation to fetch locations, slots, bookings, payments, and account details from `GET /api/dashboard/data`. The response is scoped to the signed-in role: administrators can inspect all records, while customers and owners see only their own private booking/payment/account records. Password hashes are never returned.

## Try the demo

- Register as a customer or parking owner using the Create Account form.
- Sign in as an administrator with email `admin@smartpark.com` and password `admin123`.
- Use the administrator dashboard to verify an owner and approve their submitted location before booking it as a customer.

## Included workflows

- Public landing page with About, Features, How It Works, FAQ and Contact sections.
- Public contact form opens an email draft to the configured contact address; the visitor must press Send.
- Registration, login, password visibility, demo password reset, profile updates and password changes.
- Customer parking search and filters, list/map views, location details, slot booking, history, cancellation and notifications.
- Owner location management, operating hours and facilities, individual slot status, booking check-in/out and revenue estimates.
- Administrator owner verification, location approvals, user status, booking monitoring, reports and support replies.
- Role-scoped live database record browser for locations, slots, bookings, payments, and account details.
- Responsive layouts, empty states, inline feedback, confirmation dialogs and browser geolocation support.

## Demo limitations
The browser demo UI still has demo-local views for parts of the dashboard. Secure accounts and MySQL-backed locations/bookings/payments are provided by the backend. Payments are demo transactions, not real payment processing.

The public contact form uses `mailto`; it opens the visitor's configured email app and cannot send automatically or confirm delivery. Backend payment integration requires a real provider and webhook implementation before production use. Maps and geolocation depend on browser permission and external map services.

To clear demo data, remove this site's LocalStorage in the browser developer tools.

## Project structure

```text
AI-Smart-Parking-System/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   └── app.js
└── assets/
    └── images/
        └── parking-animation.gif
```


## Deployment preparation

This repository is prepared for a Docker-based Java 17 deployment. The backend Dockerfile uses a Maven build image, so Maven does not need to be installed in the runtime image.

### Before publishing

1. Create a managed MySQL database with a database, username, and strong password. Do not expose your local XAMPP database to the internet.
2. Deploy the `backend` directory as a Docker web service. Configure these environment variables in the hosting dashboard:
   - `MYSQL_URL` — JDBC URL for the managed database (for example, `jdbc:mysql://HOST:3306/DATABASE?useSSL=true&serverTimezone=UTC`, using the host and database details from your provider).
   - `MYSQL_USERNAME` — database username.
   - `MYSQL_PASSWORD` — database password.
   - `JWT_SECRET` — a unique, randomly generated secret of at least 32 characters.
   - `CORS_ORIGINS` — the exact public HTTPS origin of the deployed frontend, with no trailing slash.
   - `PORT` — usually supplied automatically by the hosting provider; the application reads it.
3. Wait for the backend deployment, then check `https://YOUR-BACKEND-DOMAIN/api/health`. It should return `{"status":"UP","service":"smartpark-backend"}`.
4. In `js/config.js`, replace `http://localhost:8081` with the public HTTPS backend URL.
5. Deploy the folder containing `index.html`, `css/`, `js/`, and `assets/` as a static site. Set `CORS_ORIGINS` on the backend to that site's exact origin and redeploy the backend.
6. Test customer registration, owner registration, login, and dashboard data.

### Important production notes

- The included `mysql-setup.sql` credentials are for local development only. Use unique managed-database credentials in production.
- The demo administrator is seeded as `admin@smartpark.com` / `admin123`. Change or disable this demo credential before making the site public; do not rely on it for a public production administrator account.
- The payment workflow is a demo and does not process real payments.
- Never commit database passwords, JWT secrets, or other production credentials to GitHub.
