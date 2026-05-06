# Termux Setup Guide

Quick guide to run the cron job manager on Termux (Android).

## Installation

```bash
# Update packages
pkg update && pkg upgrade

# Install Python
pkg install python

# Navigate to the cron-job directory
cd /path/to/cron-job

# Install dependencies (this will install tzlocal which APScheduler needs)
pip install -r requirements.txt
```

## Configuration

Edit `app.py` and set your trigger time:

```python
TRIGGER_TIME = time(9, 0)  # Hour, Minute (24-hour format)
```

Examples:

- `time(9, 0)` = 9:00 AM
- `time(21, 30)` = 9:30 PM
- `time(14, 15)` = 2:15 PM

## Running the App

```bash
python app.py
```

You should see:

```
============================================================
Scheduler started successfully!
Timezone: System Local Time
Current time: 2026-05-06 09:27:15 PM
Trigger time configured: 09:27 PM (Hour: 21, Minute: 27)
Next trigger: 2026-05-06 09:27 PM
Scheduled jobs: 1
  - Job ID: daily_scraping_job, Next run: 2026-05-06 21:27:00
============================================================
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5000
```

## Access Web Interface

Open your browser and go to:

```
http://localhost:5000
```

You'll see:

- Current server time
- Next scheduled trigger time
- Countdown timer
- Recent execution logs
- Test trigger button

## Running in Background

### Option 1: Using nohup

```bash
nohup python app.py > output.log 2>&1 &
```

To stop:

```bash
pkill -f "python app.py"
```

### Option 2: Using screen (recommended)

```bash
# Install screen
pkg install screen

# Start a new screen session
screen -S cron-job

# Run the app
python app.py

# Detach from screen (press these keys):
# Ctrl+A, then D

# To reattach later:
screen -r cron-job

# To stop the app:
# Reattach to screen, then press Ctrl+C
```

## Testing

Test if the scheduler works:

```bash
python test_scheduler.py
```

This will schedule a test job 1 minute from now. You should see:

```
Test Scheduler Started
Current time: 2026-05-06 21:30:00
Job scheduled for: 2026-05-06 21:31:00
Waiting 60 seconds...
```

After 1 minute:

```
🎉 TEST JOB EXECUTED SUCCESSFULLY!
Current time: 2026-05-06 21:31:00
```

## Troubleshooting

### Port Already in Use

If port 5000 is already in use, edit `app.py` and change:

```python
app.run(host='0.0.0.0', port=5001, debug=False)
```

### Check if App is Running

```bash
ps aux | grep python
```

### View Logs

```bash
# If using nohup
tail -f output.log

# Check execution log
cat log.json
```

### Scheduler Not Firing

1. Make sure the app is running (check with `ps aux | grep python`)
2. Check the countdown timer on the web interface
3. Verify the trigger time is correct in `app.py`
4. After changing `TRIGGER_TIME`, restart the app

### Manual Trigger (Testing)

```bash
curl -X POST http://localhost:5000/api/trigger-now
```

Or click the "Test Trigger Now" button on the web interface.

## Notes

- The app uses **system local time** on Termux (no timezone libraries needed)
- Make sure your device doesn't kill the app when screen is off (disable battery optimization for Termux)
- The app will automatically prevent double-firing if restarted on the same day
- Execution logs are saved to `log.json`

## Keeping Termux Alive

To prevent Android from killing Termux:

1. **Acquire Wakelock** (keeps CPU running):

    ```bash
    termux-wake-lock
    ```

2. **Disable Battery Optimization**:
    - Go to Android Settings
    - Apps → Termux → Battery
    - Set to "Unrestricted" or "Don't optimize"

3. **Use Termux:Boot** (optional):
    - Install Termux:Boot from F-Droid
    - Create `~/.termux/boot/start-cron.sh`:
        ```bash
        #!/data/data/com.termux/files/usr/bin/bash
        termux-wake-lock
        cd /path/to/cron-job
        python app.py > ~/cron-job.log 2>&1 &
        ```
    - Make it executable: `chmod +x ~/.termux/boot/start-cron.sh`

## Support

If you encounter issues:

1. Check `log.json` for execution logs
2. Run `python test_scheduler.py` to verify scheduler works
3. Check if the scraping server URL is correct in `app.py`
