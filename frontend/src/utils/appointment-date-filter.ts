export const TODAY_APPOINTMENT_STATUSES_INCLUDED = [
  'SCHEDULED',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'DONOR_ARRIVED',
  'IN_PROGRESS',
  'RESCHEDULE_REQUESTED',
  'RESCHEDULED',
  'DECLINED',
  'COMPLETED',
  'CANCELLED',
  'MISSED',
  'NO_SHOW',
] as const;

export const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getTodayAppointmentQuery = () => ({
  dateFilter: 'today' as const,
  localDate: getLocalDateString(),
  timezoneOffsetMinutes: new Date().getTimezoneOffset(),
});
