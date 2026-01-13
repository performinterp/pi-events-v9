#!/usr/bin/env python3
"""
Job 4: Validate STAGED_EVENTS

Validates events and sets VALIDATION_STATUS:
- OK: All required fields present
- WARNING: Missing non-critical fields
- ERROR: Missing required fields

Generates formatting rules for color coding:
- Red: ERROR status
- Amber: WARNING status
- Green: OK status AND APPROVE=TRUE
"""

import json
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from pipeline.config import REQUIRED_FIELDS, VALIDATION_COLORS


def validate_event(row: list, headers: list) -> dict:
    """
    Validate single event row

    Required fields:
    - EVENT_DATE, EVENT_TIME, EVENT_NAME, VENUE_ID
    - TICKET_URL, IMAGE_URL, CATEGORY_ID, LANGUAGE

    Args:
        row: Event row
        headers: Column headers

    Returns:
        Dict with status, message, color
    """
    col_map = {h: i for i, h in enumerate(headers)}

    blocking_issues = []
    warnings = []

    # Check required fields
    for field in REQUIRED_FIELDS:
        idx = col_map.get(field, -1)
        if idx < 0 or idx >= len(row) or not str(row[idx]).strip():
            blocking_issues.append(f"Missing {field}")

    # Check specific validations
    event_date = row[col_map.get('EVENT_DATE', -1)] if col_map.get('EVENT_DATE', -1) >= 0 else ""
    if event_date and not str(event_date).strip():
        blocking_issues.append("EVENT_DATE is empty")

    ticket_url = row[col_map.get('TICKET_URL', -1)] if col_map.get('TICKET_URL', -1) >= 0 else ""
    if not ticket_url or not str(ticket_url).strip():
        warnings.append("Missing TICKET_URL")

    image_url = row[col_map.get('IMAGE_URL', -1)] if col_map.get('IMAGE_URL', -1) >= 0 else ""
    if not image_url or not str(image_url).strip():
        warnings.append("Missing IMAGE_URL")

    # Determine status
    if blocking_issues:
        return {
            'status': 'ERROR',
            'message': '; '.join(blocking_issues),
            'color': VALIDATION_COLORS['ERROR']
        }
    elif warnings:
        return {
            'status': 'WARNING',
            'message': '; '.join(warnings),
            'color': VALIDATION_COLORS['WARNING']
        }
    else:
        return {
            'status': 'OK',
            'message': '',
            'color': VALIDATION_COLORS['OK']
        }


def validate_all_events(staged_events_data: list) -> tuple:
    """
    Validate all events

    Args:
        staged_events_data: STAGED_EVENTS sheet data

    Returns:
        Tuple of (validated_rows, formatting_rules)
    """
    if not staged_events_data or len(staged_events_data) < 2:
        return staged_events_data, []

    headers = staged_events_data[0]
    col_map = {h: i for i, h in enumerate(headers)}
    validated_rows = [headers]
    formatting_rules = []

    validation_status_idx = col_map.get('VALIDATION_STATUS', -1)
    approve_idx = col_map.get('APPROVE', -1)

    print(f"\n✅ Validating events...")

    ok_count = 0
    warning_count = 0
    error_count = 0

    for i, row in enumerate(staged_events_data[1:], start=2):
        result = validate_event(row, headers)

        # Set VALIDATION_STATUS
        if validation_status_idx >= 0:
            # Ensure row is long enough
            while len(row) <= validation_status_idx:
                row.append("")
            row[validation_status_idx] = result['status']

        # Track counts
        if result['status'] == 'OK':
            ok_count += 1
        elif result['status'] == 'WARNING':
            warning_count += 1
        else:
            error_count += 1

        # Add formatting rule
        approve_value = row[approve_idx] if approve_idx >= 0 and approve_idx < len(row) else "FALSE"

        if result['status'] == 'ERROR':
            formatting_rules.append({
                'row': i,
                'color': result['color'],
                'reason': result['status']
            })
        elif result['status'] == 'WARNING':
            formatting_rules.append({
                'row': i,
                'color': result['color'],
                'reason': result['status']
            })
        elif result['status'] == 'OK' and approve_value == 'TRUE':
            formatting_rules.append({
                'row': i,
                'color': result['color'],
                'reason': 'OK_APPROVED'
            })

        validated_rows.append(row)

    print(f"\n📊 VALIDATION SUMMARY:")
    print(f"   ✅ OK: {ok_count}")
    print(f"   ⚠️  WARNING: {warning_count}")
    print(f"   ❌ ERROR: {error_count}")

    return validated_rows, formatting_rules


def main():
    """
    Main orchestration

    Expects:
        - staged-events-data.json (from STAGED_EVENTS sheet)

    Outputs:
        - validated-staged-events-output.json (ready to update STAGED_EVENTS sheet)
    """
    print("=" * 70)
    print("🔍 JOB 4: VALIDATE STAGED_EVENTS")
    print("=" * 70)

    # Load data
    try:
        with open('staged-events-data.json', 'r') as f:
            staged_events_data = json.load(f)
        print("✅ Loaded STAGED_EVENTS data")
    except FileNotFoundError as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

    # Validate
    validated_rows, formatting_rules = validate_all_events(staged_events_data)

    print(f"\n" + "=" * 70)
    print(f"📊 SUMMARY")
    print(f"=" * 70)
    print(f"   Total events validated: {len(validated_rows) - 1}")
    print(f"   Formatting rules generated: {len(formatting_rules)}")

    # Save output
    output = {
        'rows': validated_rows,
        'formatting_rules': formatting_rules
    }

    with open('validated-staged-events-output.json', 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n💾 Output saved to: validated-staged-events-output.json")
    print(f"   Ready to update STAGED_EVENTS sheet")


if __name__ == "__main__":
    main()
