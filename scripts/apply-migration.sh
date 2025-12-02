#!/bin/bash
# Helper script to apply database migrations

echo "To apply migration 003_fix_statistics_view.sql:"
echo ""
echo "Copy this SQL and run it in Supabase SQL Editor:"
echo "https://supabase.com/dashboard/project/wqppszoyvtqauthbvtgc/editor"
echo ""
echo "=================================="
cat supabase/migrations/003_fix_statistics_view.sql
echo "=================================="
