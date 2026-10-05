import { getOccurrenceDates, matchesTaskDate, summarizeTasks } from '../src/utils/healthTaskUtils';

describe('health task recurrence and summaries', () => {
  it('creates weekly occurrences only on the selected weekdays', () => {
    expect(getOccurrenceDates({ startDate: '2026-10-05', throughDate: '2026-10-18', repeatType: 'weekly', repeatDays: [1, 3] })).toEqual([
      '2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14',
    ]);
  });

  it('handles monthly dates and does not include dates after the series end', () => {
    expect(getOccurrenceDates({ startDate: '2026-01-31', endDate: '2026-03-31', throughDate: '2026-04-30', repeatType: 'monthly' })).toEqual([
      '2026-01-31', '2026-03-31',
    ]);
  });

  it('filters common date ranges and summarizes task statuses', () => {
    expect(matchesTaskDate('2026-10-06', 'tomorrow', '2026-10-05')).toBe(true);
    expect(summarizeTasks([{ status: 'pending', task_type: 'medicine' }, { status: 'completed', task_type: 'doctor_appointment' }, { status: 'skipped', task_type: 'health_checkup' }])).toEqual({
      total: 3, pending: 1, completed: 1, skipped: 1, medicine: 1, appointments: 1, checkups: 1,
    });
  });
});
