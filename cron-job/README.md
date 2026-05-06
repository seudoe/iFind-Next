# Scraping Cron Job Manager

A lightweight Flask-based cron job manager that triggers a remote scraping server daily at 9:00 AM.

## Features

- ✅ **Daily Trigger**: Automatically sends POST request at 9:00 AM
- ✅ **Web Interface**: Real-time countdown timer and execution logs
- ✅ **Persistence**: Logs all executions to prevent double-firing
- ✅ **Error Handling**: Gracefully handles timeouts and network errors
- ✅ **Termux Compatible**: Lightweight dependencies

## Installation

### On Termux (Android)

```bash
# Install Python and dependencies
pkg install python
pip install -r requirements.txt

# Run the app
python app.py
```

### On Linux/Mac

```bash
# Install dependencies
pip install -r requirements.txt

# Run the app
python app.py
```

## Configuration

Edit `app.py` and update the scraping server URL:

```python
SCRAPING_SERVER_URL = "https://your-scraping-server.com/api/scrape"
```

## Usage

1. **Start the server**:

    ```bash
    python app.py
    ```

2. **Access the web interface**:
    - Open browser: `http://localhost:5000`
    - View countdown timer and execution logs

3. **Manual trigger** (for testing):

    ```bash
    curl -X POST http://localhost:5000/api/trigger-now
    ```

4. **Check status** (API):
    ```bash
    curl http://localhost:5000/api/status
    ```

## How It Works

1. **Scheduler**: Uses APScheduler to run at 9:00 AM daily
2. **Persistence**: Saves execution logs to `log.json`
3. **Double-Fire Prevention**: Checks log before triggering
4. **Timeout Handling**: 30-second timeout for POST requests
5. **Web Interface**: Real-time countdown using JavaScript

## Log Format

```json
[
    {
        "date": "2026-05-07",
        "time": "09:00:00",
        "status": "SUCCESS",
        "response_code": 200
    }
]
```

## Running in Background

### Using nohup (Linux/Termux)

```bash
nohup python app.py > output.log 2>&1 &
```

### Using screen (Termux)

```bash
screen -S cron-job
python app.py
# Press Ctrl+A then D to detach
```

### Using systemd (Linux)

Create `/etc/systemd/system/scraping-cron.service`:

```ini
[Unit]
Description=Scraping Cron Job Manager
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/cron-job
ExecStart=/usr/bin/python3 app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl enable scraping-cron
sudo systemctl start scraping-cron
```

## Troubleshooting

### Scheduler Not Firing

**Issue**: Timer reaches 00:00 but nothing happens

**Solutions**:

1. **Check if scheduler is running**:
    - Look for "Scheduler started successfully!" in logs
    - Verify "Next run" time is shown for the job

2. **Restart after changing TRIGGER_TIME**:
    - The scheduler reads `TRIGGER_TIME` only on startup
    - After changing the time, you MUST restart the app:
        ```bash
        # Stop the app (Ctrl+C)
        # Then start again
        python app.py
        ```

3. **Verify timezone**:
    - Check `TIMEZONE` setting in `app.py` (default: `Asia/Kolkata`)
    - Change to your timezone:
        ```python
        TIMEZONE = pytz.timezone('America/New_York')  # Example
        ```
    - Common timezones: `UTC`, `Asia/Kolkata`, `America/New_York`, `Europe/London`

4. **Test the scheduler**:

    ```bash
    python test_scheduler.py
    ```

    This will schedule a test job 1 minute from now to verify APScheduler is working.

5. **Check logs**:
    - When the job fires, you'll see: "🚀 TRIGGER_SCRAPING FUNCTION CALLED!"
    - If you don't see this, the scheduler isn't firing

6. **Install missing dependency**:
    ```bash
    pip install pytz
    ```

### Port Already in Use

```python
app.run(host='0.0.0.0', port=5001)  # Change port
```

### Timezone Issues

The script uses system time. Ensure your system timezone is correct:

```bash
# Linux/Termux
timedatectl set-timezone Asia/Kolkata
```

### Network Errors

Check the `log.json` file for error details. Common issues:

- **TIMEOUT**: Hugging Face Space is sleeping (cold start takes 30-60s)
- **Connection refused**: Check if scraping server URL is correct
- **Already triggered today**: Check `log.json` and delete today's entry if needed

## API Endpoints

- `GET /` - Web interface with countdown timer
- `GET /api/status` - Current status and logs (JSON)
- `POST /api/trigger-now` - Manual trigger for testing

## License

MIT
