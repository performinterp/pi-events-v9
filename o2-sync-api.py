#!/usr/bin/env python3
"""
O2 Events Sync API Server
Lightweight Flask API for triggering O2 scraper pipeline from admin UI
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import subprocess
import json
import os
import sys
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for local development

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def run_python_script(script_name):
    """
    Execute a Python script and capture output
    Returns: (success, stdout, stderr)
    """
    script_path = os.path.join(SCRIPT_DIR, script_name)

    if not os.path.exists(script_path):
        return False, "", f"Script not found: {script_path}"

    try:
        result = subprocess.run(
            [sys.executable, script_path],
            cwd=SCRIPT_DIR,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )

        return result.returncode == 0, result.stdout, result.stderr

    except subprocess.TimeoutExpired:
        return False, "", "Script execution timeout (5 minutes)"
    except Exception as e:
        return False, "", str(e)


def parse_scraper_output(stdout):
    """
    Parse o2-scraper-enhanced.py output to extract event count
    """
    total_events = 0

    for line in stdout.split('\n'):
        if 'events extracted' in line.lower() or 'total events:' in line.lower():
            # Try to extract number from line
            import re
            numbers = re.findall(r'\d+', line)
            if numbers:
                total_events = int(numbers[0])
                break

    # Fallback: try to load from o2-events-all.json
    if total_events == 0:
        json_path = os.path.join(SCRIPT_DIR, 'o2-events-all.json')
        if os.path.exists(json_path):
            try:
                with open(json_path, 'r') as f:
                    events = json.load(f)
                    total_events = len(events)
            except:
                pass

    return total_events


def parse_sync_output(stdout):
    """
    Parse o2-sync-complete.py output to extract sync statistics including deletion counts
    """
    stats = {
        'total_scraped': 0,
        'already_public_approved': 0,
        'already_pre_approved': 0,
        'new_events_added': 0,
        'deleted_pre_count': 0,
        'deleted_pub_count': 0,
        'range_written': ''
    }

    for line in stdout.split('\n'):
        line_lower = line.lower()

        if 'scraped:' in line_lower:
            import re
            numbers = re.findall(r'\d+', line)
            if numbers:
                stats['total_scraped'] = int(numbers[0])

        elif 'skipped (in public_approved)' in line_lower or 'in public_approved:' in line_lower:
            import re
            numbers = re.findall(r'\d+', line)
            if numbers:
                stats['already_public_approved'] = int(numbers[0])

        elif 'skipped (in pre' in line_lower or 'in pre_approved:' in line_lower:
            import re
            numbers = re.findall(r'\d+', line)
            if numbers:
                stats['already_pre_approved'] = int(numbers[0])

        elif 'new events to add:' in line_lower or 'new events:' in line_lower:
            import re
            numbers = re.findall(r'\d+', line)
            if numbers:
                stats['new_events_added'] = int(numbers[0])

        elif 'deleted from pre_approved:' in line_lower or 'o2 events deleted from pre_approved:' in line_lower:
            import re
            numbers = re.findall(r'\d+', line)
            if numbers:
                stats['deleted_pre_count'] = int(numbers[0])

        elif 'deleted from public_approved:' in line_lower or 'events deleted from public_approved:' in line_lower:
            import re
            numbers = re.findall(r'\d+', line)
            if numbers:
                stats['deleted_pub_count'] = int(numbers[0])

        elif 'range' in line_lower and ':' in line:
            # Extract range like "A2:N134"
            import re
            range_match = re.search(r'[A-Z]\d+:[A-Z]\d+', line)
            if range_match:
                stats['range_written'] = range_match.group(0)

    return stats


@app.route('/api/sync-o2-events', methods=['POST', 'GET'])
def sync_o2_events():
    """
    Main endpoint to trigger O2 events sync pipeline

    Returns JSON:
    {
        "success": true/false,
        "scraped": 135,
        "newEvents": 133,
        "alreadyCurated": 2,
        "alreadyPreApproved": 0,
        "range": "A2:N134",
        "added": 133,
        "skipped": 2,
        "timestamp": "2025-12-05 12:30:45",
        "error": "error message if failed"
    }
    """

    try:
        # Step 1: Run scraper
        print(f"[{datetime.now()}] Starting O2 scraper...")
        scrape_success, scrape_stdout, scrape_stderr = run_python_script('o2-scraper-enhanced.py')

        if not scrape_success:
            print(f"[{datetime.now()}] Scraper failed")
            print(f"STDERR: {scrape_stderr}")
            return jsonify({
                'success': False,
                'error': f'Scraper failed: {scrape_stderr}',
                'step': 'scrape',
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }), 500

        # Parse scraper output
        total_scraped = parse_scraper_output(scrape_stdout)
        print(f"[{datetime.now()}] Scraped {total_scraped} events")

        # Step 2: Run sync with de-duplication
        print(f"[{datetime.now()}] Starting sync with de-duplication...")
        sync_success, sync_stdout, sync_stderr = run_python_script('o2-sync-complete.py')

        if not sync_success:
            print(f"[{datetime.now()}] Sync failed")
            print(f"STDERR: {sync_stderr}")
            return jsonify({
                'success': False,
                'error': f'Sync failed: {sync_stderr}',
                'step': 'sync',
                'scraped': total_scraped,
                'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            }), 500

        # Parse sync output
        stats = parse_sync_output(sync_stdout)

        # If total_scraped wasn't captured from scraper, use sync stats
        if total_scraped == 0:
            total_scraped = stats.get('total_scraped', 0)

        # Calculate final statistics
        already_public_approved = stats.get('already_public_approved', 0)
        already_pre_approved = stats.get('already_pre_approved', 0)
        new_events_added = stats.get('new_events_added', 0)
        deleted_pre_count = stats.get('deleted_pre_count', 0)
        deleted_pub_count = stats.get('deleted_pub_count', 0)
        total_skipped = already_public_approved + already_pre_approved

        print(f"[{datetime.now()}] Sync complete:")
        print(f"  - Scraped: {total_scraped}")
        print(f"  - New events added: {new_events_added}")
        print(f"  - Already in PUBLIC_APPROVED: {already_public_approved}")
        print(f"  - Already in PRE_APPROVED EVENTS: {already_pre_approved}")
        print(f"  - Outdated O2 events deleted from PRE_APPROVED: {deleted_pre_count}")
        print(f"  - Outdated events deleted from PUBLIC_APPROVED: {deleted_pub_count}")

        # Success response
        return jsonify({
            'success': True,
            'scraped': total_scraped,
            'newEvents': new_events_added,
            'alreadyPublicApproved': already_public_approved,
            'alreadyPreApproved': already_pre_approved,
            'deletedPreCount': deleted_pre_count,
            'deletedPubCount': deleted_pub_count,
            'range': stats.get('range_written', ''),
            'added': new_events_added,
            'skipped': total_skipped,
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        })

    except Exception as e:
        print(f"[{datetime.now()}] Unexpected error: {str(e)}")
        import traceback
        traceback.print_exc()

        return jsonify({
            'success': False,
            'error': f'Unexpected error: {str(e)}',
            'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'o2-sync-api',
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    })


@app.route('/api/status', methods=['GET'])
def get_status():
    """
    Get current status - check if required scripts exist
    """
    scraper_exists = os.path.exists(os.path.join(SCRIPT_DIR, 'o2-scraper-enhanced.py'))
    sync_exists = os.path.exists(os.path.join(SCRIPT_DIR, 'o2-sync-complete.py'))

    return jsonify({
        'ready': scraper_exists and sync_exists,
        'scraper_exists': scraper_exists,
        'sync_exists': sync_exists,
        'working_directory': SCRIPT_DIR,
        'timestamp': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    })


if __name__ == '__main__':
    print("=" * 60)
    print("O2 Events Sync API Server")
    print("=" * 60)
    print(f"Working directory: {SCRIPT_DIR}")
    print(f"Starting server on http://localhost:5001")
    print("=" * 60)

    # Run on port 5001 to avoid conflicts with other services
    app.run(host='0.0.0.0', port=5001, debug=True)
