#!/bin/bash

# scripts/complete-phase.sh
# Usage: ./scripts/complete-phase.sh <phase_number> [--dry-run]

PHASE=$1
DRY_RUN=$2

if [ -z "$PHASE" ]; then
  echo "Usage: ./scripts/complete-phase.sh <phase_number> [--dry-run]"
  exit 1
fi

PLAN_FILE="opencart-node-plan.md"

# 1. Identify Phase Name from the plan file
# This assumes the format: ### Phase N — Phase Name
PHASE_HEADER=$(grep "### Phase $PHASE —" "$PLAN_FILE" | head -n 1)

if [ -z "$PHASE_HEADER" ]; then
  echo "Error: Phase $PHASE not found in $PLAN_FILE"
  exit 1
fi

PHASE_NAME=$(echo "$PHASE_HEADER" | sed "s/### Phase $PHASE — //")

echo "Detected Phase $PHASE: $PHASE_NAME"

# 2. Update status in the plan file (Simplified: just echo for now, or use sed to mark [x])
# In a real scenario, we might want to more intelligently mark subtasks as [x]
# For now, we'll mark the phase header itself as completed if it doesn't have [x]
if [ "$DRY_RUN" != "--dry-run" ]; then
    # This is a bit complex with sed, let's just make sure we commit the plan
    echo "Marking Phase $PHASE as completed in $PLAN_FILE..."
    # Logic to check off items could be added here
fi

# 3. Git Operations
COMMIT_MSG="Complete Phase $PHASE: $PHASE_NAME"

if [ "$DRY_RUN" == "--dry-run" ]; then
  echo "[DRY RUN] Would execute:"
  echo "git add ."
  echo "git commit -m \"$COMMIT_MSG\""
  echo "git push origin modcart_v1"
else
  echo "Executing git operations..."
  git add .
  git commit -m "$COMMIT_MSG"
  
  # Check if remote exists before pushing
  if git remote | grep -q "origin"; then
    git push origin modcart_v1
  else
    echo "Warning: No remote 'origin' found. Skipping push."
    echo "Please run: git remote add origin <URL>"
  fi
fi

echo "Phase $PHASE completion process finished."
