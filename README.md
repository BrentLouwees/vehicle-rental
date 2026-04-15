# Vehicle Rental App

A car and motorcycle rental web application built with FastAPI + Vanilla JS.

## Requirements

- Python 3.8+
- XAMPP (for MySQL)

## Setup

### 1. Start XAMPP MySQL
Open XAMPP Control Panel and click **Start** next to **MySQL**.

### 2. Clone the repo
```bash
git clone <repo-url>
cd "Vehicle Rental"
```

### 3. Install backend dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 4. Create your `.env` file
```bash
cp .env.example .env
```

Open `.env` and set your MySQL credentials. If your XAMPP MySQL has no password (default):
```
DATABASE_URL=mysql+pymysql://root:@localhost/vehicle_rental
SECRET_KEY=any-long-random-string-here
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:8080
```

### 5. Create the database and run migrations
In XAMPP, open **phpMyAdmin** → create a database named `vehicle_rental`.

Then run the seed data:
```bash
python database/seed.py
```

### 6. Start the backend
```bash
uvicorn main:app --reload
```

### 7. Start the frontend (new terminal)
```bash
cd ../frontend
python -m http.server 8080
```

### 8. Open in browser
- **App:** http://localhost:8080
- **API docs:** http://localhost:8000/docs

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Manager | manager@rental.com | Manager123! |
| Staff | staff1@rental.com | Staff123! |
| Staff | staff2@rental.com | Staff123! |
| Customer | customer1@test.com | Customer123! |
| Customer | customer2@test.com | Customer123! |

## Running Tests

Make sure MySQL is running and the `vehicle_rental_test` database will be created automatically.

```bash
cd backend
python -m pytest tests/ -v
```
