#!/usr/bin/env python3
"""
Pipeline Orchestrator - Runs all jobs sequentially

This script coordinates the full PI Events pipeline:
1. Populate INGEST_FROM_MONTHLY (Job 1)
2. Build STAGED_EVENTS (Job 2)
3. Enrich STAGED_EVENTS (Job 3)
4. Validate STAGED_EVENTS (Job 4)
5. (Optional) Export to READY_TO_PUBLISH (Job 5)

Usage:
    python3 pipeline/run_full_pipeline.py [--export]

Options:
    --export    Also run Job 5 (export to READY_TO_PUBLISH)
                Default: Skip Job 5 (staff must manually approve first)

This script expects Claude Code to have already fetched sheet data and saved to JSON files.
It processes the data and outputs results that Claude Code can write back to sheets.
"""

import subprocess
import sys
import json
import os
from datetime import datetime


def print_header(title):
    """Print section header"""
    print("\n" + "=" * 70)
    print(title)
    print("=" * 70)


def run_job(job_name, script_path):
    """
    Run a pipeline job

    Args:
        job_name: Display name of the job
        script_path: Path to the job script

    Returns:
        True if successful, False otherwise
    """
    print_header(f"🚀 RUNNING: {job_name}")

    try:
        result = subprocess.run(
            ['python3', script_path],
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )

        print(result.stdout)

        if result.stderr:
            print("STDERR:", result.stderr)

        if result.returncode != 0:
            print(f"❌ {job_name} failed with exit code {result.returncode}")
            return False

        print(f"✅ {job_name} completed successfully")
        return True

    except subprocess.TimeoutExpired:
        print(f"❌ {job_name} timed out after 5 minutes")
        return False
    except Exception as e:
        print(f"❌ {job_name} failed with error: {e}")
        return False


def main():
    """
    Main orchestration

    Runs pipeline jobs in sequence:
    1. Job 1: Populate INGEST_FROM_MONTHLY
    2. Job 2: Build STAGED_EVENTS
    3. Job 3: Enrich STAGED_EVENTS
    4. Job 4: Validate STAGED_EVENTS
    5. Job 5: Export to READY_TO_PUBLISH (optional - only if --export flag)
    """
    print_header("🔄 PI EVENTS PIPELINE - FULL RUN")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Check if export flag is present
    export_enabled = '--export' in sys.argv

    if export_enabled:
        print("\n📋 Mode: FULL PIPELINE (including export)")
        print("   Jobs 1-5 will run")
    else:
        print("\n📋 Mode: PREPARE FOR REVIEW (no export)")
        print("   Jobs 1-4 will run")
        print("   Staff must manually approve events in STAGED_EVENTS")
        print("   Then run with --export flag to publish")

    # Job 1: Populate INGEST_FROM_MONTHLY
    if not run_job("Job 1: Populate INGEST_FROM_MONTHLY",
                   "pipeline/populate_ingest_from_monthly.py"):
        print("\n❌ Pipeline failed at Job 1")
        sys.exit(1)

    # Job 2: Build STAGED_EVENTS
    if not run_job("Job 2: Build STAGED_EVENTS",
                   "pipeline/build_staged_events.py"):
        print("\n❌ Pipeline failed at Job 2")
        sys.exit(1)

    # Job 3: Enrich STAGED_EVENTS
    if not run_job("Job 3: Enrich STAGED_EVENTS",
                   "pipeline/enrich_staged_events.py"):
        print("\n❌ Pipeline failed at Job 3")
        sys.exit(1)

    # Job 4: Validate STAGED_EVENTS
    if not run_job("Job 4: Validate STAGED_EVENTS",
                   "pipeline/validate_staged_events.py"):
        print("\n❌ Pipeline failed at Job 4")
        sys.exit(1)

    # Job 5: Export to READY_TO_PUBLISH (optional)
    if export_enabled:
        if not run_job("Job 5: Export to READY_TO_PUBLISH",
                       "pipeline/export_to_ready_to_publish.py"):
            print("\n❌ Pipeline failed at Job 5")
            sys.exit(1)

    # Success summary
    print_header("✅ PIPELINE COMPLETE")
    print(f"Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    if export_enabled:
        print("\n📊 Output files generated:")
        print("   - ingest-from-monthly-output.json → Write to INGEST_FROM_MONTHLY")
        print("   - staged-events-output.json → Write to STAGED_EVENTS")
        print("   - enriched-staged-events-output.json → Update STAGED_EVENTS")
        print("   - validated-staged-events-output.json → Update STAGED_EVENTS")
        print("   - ready-to-publish-output.json → Write to READY_TO_PUBLISH")
        print("\n✅ All jobs completed. Ready to write to sheets via MCP.")
    else:
        print("\n📊 Output files generated:")
        print("   - ingest-from-monthly-output.json → Write to INGEST_FROM_MONTHLY")
        print("   - staged-events-output.json → Write to STAGED_EVENTS")
        print("   - enriched-staged-events-output.json → Update STAGED_EVENTS")
        print("   - validated-staged-events-output.json → Update STAGED_EVENTS")
        print("\n📋 NEXT STEPS:")
        print("   1. Review STAGED_EVENTS in Google Sheets")
        print("   2. Set APPROVE=TRUE for events to publish")
        print("   3. Run pipeline again with --export flag")

    sys.exit(0)


if __name__ == "__main__":
    main()
