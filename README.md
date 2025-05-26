# CTA Bus Tracker

A web application for tracking CTA buses in real-time.

## Project Structure

The project consists of two main components:
- `frontend/`: Contains the web interface
- `backend/`: Contains the Flask API server

## Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows, use: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the backend server:
   ```bash
   python app.py
   ```
   The server will start on `http://localhost:5000`

## Frontend Setup

The frontend is a static web application that can be served using any web server. For development, you can use Python's built-in HTTP server:

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Start a simple HTTP server:
   ```bash
   python -m http.server 8000
   ```
   The frontend will be available at `http://localhost:8000`

## Connecting Frontend to Backend

The frontend is already configured to connect to the backend API at `http://localhost:5000`. Make sure both servers are running:

1. Backend server on port 5000
2. Frontend server on port 8000

Open your web browser and navigate to `http://localhost:8000` to use the application.

## Development

- Backend API endpoints are available at `http://localhost:5000/api/`
- Frontend static files are served from the `frontend/` directory
- The main application logic is in `backend/app.py`
- Frontend JavaScript files are in `frontend/js/`
- Frontend styles are in `frontend/css/`

## Requirements

- Python 3.7 or higher
- Modern web browser with JavaScript enabled
- Internet connection for CTA API access
