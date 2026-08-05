"""
Quick test to verify APScheduler is working correctly.
This will schedule a job to run 1 minute from now.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, timedelta
import time
import logging

# Use system local time (Termux compatible)
TIMEZONE = None

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def test_job():
    """Test function that will be called by scheduler."""
    logger.info("=" * 60)
    logger.info("🎉 TEST JOB EXECUTED SUCCESSFULLY!")
    logger.info(f"Current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)

if __name__ == '__main__':
    scheduler = BackgroundScheduler()
    now = datetime.now()
    
    # Schedule job to run 1 minute from now
    trigger_time = now + timedelta(minutes=1)
    
    scheduler.add_job(
        func=test_job,
        trigger='cron',
        hour=trigger_time.hour,
        minute=trigger_time.minute,
        second=trigger_time.second,
        id='test_job'
    )
    
    scheduler.start()
    
    logger.info("=" * 60)
    logger.info("Test Scheduler Started")
    logger.info(f"Timezone: System Local Time")
    logger.info(f"Current time: {now.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Job scheduled for: {trigger_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Waiting {(trigger_time - now).total_seconds():.0f} seconds...")
    
    jobs = scheduler.get_jobs()
    for job in jobs:
        logger.info(f"Job: {job.id}, Next run: {job.next_run_time}")
    
    logger.info("=" * 60)
    
    try:
        # Keep the script running for 2 minutes
        time.sleep(120)
    except KeyboardInterrupt:
        pass
    finally:
        scheduler.shutdown()
        logger.info("Scheduler shut down")
