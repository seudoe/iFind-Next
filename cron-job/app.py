"""
Flask-based cron job manager for triggering remote scraping server.
Runs daily at 9:00 AM and provides a web interface with countdown timer.
"""

from flask import Flask, render_template_string, jsonify
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, time, timedelta
import requests
import json
import os
import logging

# Timezone support is optional - use system local time on Termux
TIMEZONE = None
TIMEZONE_NAME = 'System Local Time'

app = Flask(__name__)

# Configuration
SCRAPING_SERVER_URL = "https://seudoe-internscraper.hf.space/scrape"
SCRAPERS = ["github", "internshala", "indeed", "naukri", "unstop", "freshersworld", "letsintern"]
LOG_FILE = "log.json"
TRIGGER_TIME = time(21, 27)  # Configure your trigger time here


# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_log():
    """Load execution log from disk."""
    if os.path.exists(LOG_FILE):
        try:
            with open(LOG_FILE, 'r') as f:
                return json.load(f)
        except:
            return []
    return []


def save_log(entry):
    """Save execution log entry to disk."""
    log = load_log()
    log.append(entry)
    with open(LOG_FILE, 'w') as f:
        json.dump(log, f, indent=2)


def already_triggered_today():
    """Check if we already triggered today to prevent double-firing."""
    log = load_log()
    today = datetime.now().date().isoformat()
    return any(entry.get('date') == today and entry.get('status') == 'SUCCESS' for entry in log)


def trigger_scraping():
    """Send POST request to scraping server."""
    logger.info("=" * 60)
    logger.info("🚀 TRIGGER_SCRAPING FUNCTION CALLED!")
    logger.info(f"Current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)
    
    if already_triggered_today():
        logger.info("Already triggered today, skipping...")
        return

    logger.info(f"Triggering scraping server at {SCRAPING_SERVER_URL}")
    
    payload = {
        "scrapers": SCRAPERS
    }
    
    max_retries = 3
    retry_delay = 10  # seconds between retries
    
    for attempt in range(1, max_retries + 1):
        try:
            logger.info(f"Attempt {attempt}/{max_retries}...")
            
            # Increased timeout for Hugging Face cold start (can take 30-60s to wake up)
            response = requests.post(
                SCRAPING_SERVER_URL,
                json=payload,
                timeout=120,  # 2 minute timeout for cold start + job initiation
                headers={'Content-Type': 'application/json'}
            )
            
            # Check if we got HTML (Space is still waking up)
            content_type = response.headers.get('Content-Type', '')
            if 'text/html' in content_type:
                logger.warning(f"⚠️ Attempt {attempt}: Space is still waking up (got HTML response)")
                logger.info(f"   Status: {response.status_code}, Content-Type: {content_type}")
                
                if attempt < max_retries:
                    logger.info(f"   Waiting {retry_delay} seconds before retry...")
                    import time
                    time.sleep(retry_delay)
                    continue
                else:
                    logger.error("❌ Space failed to wake up after all retries")
                    entry = {
                        "date": datetime.now().date().isoformat(),
                        "time": datetime.now().time().isoformat(),
                        "status": "FAILED (Space not ready)",
                        "response_code": response.status_code,
                        "error": "Hugging Face Space is sleeping and didn't wake up in time"
                    }
                    save_log(entry)
                    return
            
            # HTTP success codes:
            # 200 (OK) - Request succeeded
            # 202 (Accepted) - Request accepted for async processing
            is_success = response.status_code in [200, 202]
            status = "SUCCESS" if is_success else f"FAILED (HTTP {response.status_code})"
            
            # Log the response
            logger.info(f"Response Status: {response.status_code}")
            logger.info(f"Response Content-Type: {content_type}")
            
            # Parse job_id from response if available
            job_id = None
            response_data = None
            try:
                response_data = response.json()
                job_id = response_data.get('job_id')
                if job_id:
                    logger.info(f"✅ Job started with ID: {job_id}")
                    logger.info(f"   Status: {response_data.get('status', 'unknown')}")
                    logger.info(f"   Message: {response_data.get('message', 'N/A')}")
                else:
                    logger.warning(f"⚠️ No job_id in response: {response_data}")
            except Exception as e:
                logger.error(f"Failed to parse JSON response: {e}")
                logger.error(f"Raw response (first 500 chars): {response.text[:500]}")
            
            entry = {
                "date": datetime.now().date().isoformat(),
                "time": datetime.now().time().isoformat(),
                "status": status,
                "response_code": response.status_code,
                "scrapers": SCRAPERS,
                "job_id": job_id,
                "response": response_data,
                "attempts": attempt
            }
            
            save_log(entry)
            logger.info(f"Scraping trigger completed: {status}")
            return  # Success, exit the retry loop
            
        except requests.exceptions.Timeout:
            logger.error(f"⚠️ Attempt {attempt}: Request timed out")
            if attempt < max_retries:
                logger.info(f"   Waiting {retry_delay} seconds before retry...")
                import time
                time.sleep(retry_delay)
                continue
            else:
                entry = {
                    "date": datetime.now().date().isoformat(),
                    "time": datetime.now().time().isoformat(),
                    "status": "TIMEOUT",
                    "error": "Request timed out after all retries (Hugging Face may be sleeping)"
                }
                save_log(entry)
                logger.error("❌ Scraping server request timed out after all retries")
                
        except Exception as e:
            logger.error(f"⚠️ Attempt {attempt}: Error - {e}")
            if attempt < max_retries:
                logger.info(f"   Waiting {retry_delay} seconds before retry...")
                import time
                time.sleep(retry_delay)
                continue
            else:
                entry = {
                    "date": datetime.now().date().isoformat(),
                    "time": datetime.now().time().isoformat(),
                    "status": "ERROR",
                    "error": str(e)
                }
                save_log(entry)
                logger.error(f"❌ Error triggering scraping after all retries: {e}")


def get_next_trigger_time():
    """Calculate the next 9:00 AM trigger time."""
    now = datetime.now()
    next_trigger = datetime.combine(now.date(), TRIGGER_TIME)
    
    # If it's already past 9:00 AM today, schedule for tomorrow
    if now.time() >= TRIGGER_TIME:
        next_trigger += timedelta(days=1)
    
    return next_trigger


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scraping Cron Job Manager</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            max-width: 600px;
            width: 100%;
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 28px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .info-box {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .info-label {
            color: #666;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 5px;
        }
        .info-value {
            color: #333;
            font-size: 18px;
            font-weight: 600;
        }
        .countdown {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            color: white;
            margin-bottom: 20px;
        }
        .countdown-label {
            font-size: 14px;
            opacity: 0.9;
            margin-bottom: 15px;
        }
        .countdown-timer {
            font-size: 48px;
            font-weight: bold;
            font-family: 'Courier New', monospace;
        }
        .log-section {
            margin-top: 30px;
        }
        .log-title {
            color: #333;
            font-size: 18px;
            margin-bottom: 15px;
            font-weight: 600;
        }
        .log-entry {
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 12px 15px;
            margin-bottom: 10px;
            border-radius: 4px;
            font-size: 14px;
        }
        .log-entry.success { border-left-color: #28a745; }
        .log-entry.error { border-left-color: #dc3545; }
        .log-entry.timeout { border-left-color: #ffc107; }
        .log-date {
            font-weight: 600;
            color: #333;
        }
        .log-status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 10px;
        }
        .log-status.success { background: #d4edda; color: #155724; }
        .log-status.error { background: #f8d7da; color: #721c24; }
        .log-status.timeout { background: #fff3cd; color: #856404; }
        .test-button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin-top: 20px;
            transition: transform 0.2s;
        }
        .test-button:hover {
            transform: translateY(-2px);
        }
        .test-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🕐 Scraping Cron Job Manager</h1>
        <p class="subtitle">Automated daily scraping at 9:00 AM</p>
        
        <div class="info-box">
            <div class="info-label">Current Server Time</div>
            <div class="info-value" id="current-time">{{ current_time }}</div>
        </div>
        
        <div class="info-box">
            <div class="info-label">Next Scheduled Trigger</div>
            <div class="info-value">{{ trigger_time }} Daily</div>
        </div>
        
        <div class="countdown">
            <div class="countdown-label">Time Until Next Trigger</div>
            <div class="countdown-timer" id="countdown">--:--:--</div>
        </div>
        
        <button class="test-button" id="test-trigger" onclick="testTrigger()">
            Trigger Now
        </button>
        <div id="test-result" style="margin-top: 10px; text-align: center; font-size: 14px;"></div>
        
        <div class="log-section">
            <div class="log-title">Recent Executions</div>
            <div id="log-container">
                {% if log_entries %}
                    {% for entry in log_entries[-5:]|reverse %}
                    <div class="log-entry {{ entry.status|lower }}">
                        <span class="log-date">{{ entry.date }} {{ entry.time[:8] }}</span>
                        <span class="log-status {{ entry.status|lower }}">{{ entry.status }}</span>
                        {% if entry.job_id %}
                        <div style="font-size: 12px; color: #666; margin-top: 5px;">
                            Job ID: {{ entry.job_id }}
                        </div>
                        {% endif %}
                    </div>
                    {% endfor %}
                {% else %}
                    <div class="log-entry">No executions yet</div>
                {% endif %}
            </div>
        </div>
    </div>
    
    <script>
        // Get trigger time from server
        const TRIGGER_HOUR = {{ trigger_hour }};
        const TRIGGER_MINUTE = {{ trigger_minute }};
        
        function updateTime() {
            const now = new Date();
            document.getElementById('current-time').textContent = now.toLocaleString();
        }
        
        function updateCountdown() {
            const now = new Date();
            let next = new Date();
            next.setHours(TRIGGER_HOUR, TRIGGER_MINUTE, 0, 0);
            
            // If past trigger time today, set to tomorrow
            if (now.getHours() > TRIGGER_HOUR || 
                (now.getHours() === TRIGGER_HOUR && now.getMinutes() >= TRIGGER_MINUTE)) {
                next.setDate(next.getDate() + 1);
            }
            
            const diff = next - now;
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            
            document.getElementById('countdown').textContent = 
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        
        async function testTrigger() {
            const button = document.getElementById('test-trigger');
            const result = document.getElementById('test-result');
            
            button.disabled = true;
            button.textContent = '⏳ Triggering...';
            result.textContent = '';
            result.style.color = '#666';
            
            try {
                const response = await fetch('/api/trigger-now', {
                    method: 'POST'
                });
                const data = await response.json();
                
                if (data.success) {
                    result.textContent = '✅ Trigger successful! Check logs below.';
                    result.style.color = '#28a745';
                    // Reload page after 2 seconds to show new log entry
                    setTimeout(() => location.reload(), 2000);
                } else {
                    result.textContent = '❌ Error: ' + (data.error || 'Unknown error');
                    result.style.color = '#dc3545';
                }
            } catch (error) {
                result.textContent = '❌ Network error: ' + error.message;
                result.style.color = '#dc3545';
            } finally {
                button.disabled = false;
                button.textContent = 'Test Trigger Now';
            }
        }
        
        // Update every second
        setInterval(updateTime, 1000);
        setInterval(updateCountdown, 1000);
        updateTime();
        updateCountdown();
    </script>
</body>
</html>
"""


@app.route('/')
def index():
    """Display the web interface with countdown timer."""
    current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_entries = load_log()
    next_trigger = get_next_trigger_time()
    
    # Format trigger time for display
    trigger_time_str = TRIGGER_TIME.strftime('%I:%M %p')  # e.g., "09:00 AM"
    
    return render_template_string(
        HTML_TEMPLATE,
        current_time=current_time,
        log_entries=log_entries,
        trigger_time=trigger_time_str,
        trigger_hour=TRIGGER_TIME.hour,
        trigger_minute=TRIGGER_TIME.minute
    )


@app.route('/api/status')
def status():
    """API endpoint to get current status."""
    next_trigger = get_next_trigger_time()
    
    return jsonify({
        'current_time': datetime.now().isoformat(),
        'next_trigger': next_trigger.isoformat(),
        'already_triggered_today': already_triggered_today(),
        'recent_logs': load_log()[-5:]
    })


@app.route('/api/trigger-now', methods=['POST'])
def trigger_now():
    """Manual trigger endpoint for testing."""
    try:
        trigger_scraping()
        return jsonify({'success': True, 'message': 'Trigger initiated'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    # Initialize scheduler - will use system local timezone via tzlocal
    scheduler = BackgroundScheduler()
    
    # Add job with the configured trigger time
    scheduler.add_job(
        func=trigger_scraping,
        trigger='cron',
        hour=TRIGGER_TIME.hour,
        minute=TRIGGER_TIME.minute,
        id='daily_scraping_job'
    )
    scheduler.start()
    
    logger.info("=" * 60)
    logger.info("Scheduler started successfully!")
    logger.info(f"Timezone: {TIMEZONE_NAME}")
    
    current_time_str = datetime.now().strftime('%Y-%m-%d %I:%M:%S %p')
    
    logger.info(f"Current time: {current_time_str}")
    logger.info(f"Trigger time configured: {TRIGGER_TIME.strftime('%I:%M %p')} (Hour: {TRIGGER_TIME.hour}, Minute: {TRIGGER_TIME.minute})")
    logger.info(f"Next trigger: {get_next_trigger_time().strftime('%Y-%m-%d %I:%M %p')}")
    
    # List all scheduled jobs to verify
    jobs = scheduler.get_jobs()
    logger.info(f"Scheduled jobs: {len(jobs)}")
    for job in jobs:
        logger.info(f"  - Job ID: {job.id}, Next run: {job.next_run_time}")
    
    logger.info("=" * 60)
    
    try:
        # Run Flask app
        app.run(host='0.0.0.0', port=5000, debug=False)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        logger.info("Scheduler shut down")
