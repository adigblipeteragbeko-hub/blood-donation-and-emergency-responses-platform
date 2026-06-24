-- Allow first-time donors to register before hospital blood group confirmation.
ALTER TYPE "BloodGroup" ADD VALUE IF NOT EXISTS 'UNKNOWN' BEFORE 'O_POS';
