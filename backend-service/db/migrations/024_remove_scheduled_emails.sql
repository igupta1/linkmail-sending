-- Migration 024: Remove scheduled emails feature
-- This migration drops the scheduled_emails table and all related indexes

DROP TABLE IF EXISTS scheduled_emails CASCADE;
