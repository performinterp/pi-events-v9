# Running O2 Event Deletion

## Steps for Claude Code to execute:

1. **Fetch current sheet data via MCP**:
   ```
   - Get PRE_APPROVED EVENTS sheet
   - Get PUBLIC_APPROVED sheet
   - Save to temp-pre-approved.json and temp-public-approved.json
   ```

2. **Run filtering script**:
   ```bash
   python3 apply-deletion-to-sheets.py temp-pre-approved.json temp-public-approved.json
   ```

3. **Write cleaned data back via MCP**:
   ```
   - Read cleaned-pre-approved.json
   - Read cleaned-public-approved.json
   - Use MCP update_cells to write full sheets
   ```

## Current Status:
- ✅ Filtering script created and tested
- ⏳ Waiting for Claude Code to fetch real sheet data and apply
