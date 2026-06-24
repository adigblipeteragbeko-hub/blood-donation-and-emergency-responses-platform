UPDATE "InventoryLog" log
SET "reason" = 'Successful donation ' || d."donationNumber" || ' from appointment ' || a."appointmentReference" || ' (' || COALESCE(donor."donorNumber", donor."fullName", 'donor') || ')'
FROM "Appointment" a
JOIN "Donation" d ON d."id" = a."donationId"
JOIN "Donor" donor ON donor."id" = a."donorId"
WHERE log."reason" ILIKE '%' || a."appointmentReference" || '%'
  AND d."donationNumber" IS NOT NULL
  AND log."reason" NOT ILIKE '%' || d."donationNumber" || '%';
