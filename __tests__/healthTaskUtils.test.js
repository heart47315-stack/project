import {
  getOccurrenceDates,
  matchesTaskDate,
  prepareTaskReminders,
  summarizeTasks,
} from '../src/utils/healthTaskUtils';

describe('health task recurrence and summaries', () => {
  it('creates one-time and daily occurrences with an optional empty end date', () => {
    expect(getOccurrenceDates({
      startDate: '2026-10-15',
      repeatType: 'none',
      throughDate: '2026-10-18',
    })).toEqual(['2026-10-15']);
    expect(getOccurrenceDates({
      startDate: '2026-10-15',
      repeatType: 'daily',
      throughDate: '2026-10-18',
    })).toEqual(['2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  });

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

  it('keeps the task saveable without reminders when permission is denied', async () => {
    const task = { enabled: true, notification_id: null };
    const scheduleRows = jest.fn();

    const result = await prepareTaskReminders(
      [task],
      async () => ({ granted: false }),
      scheduleRows
    );

    expect(result).toEqual({
      data: [{ enabled: false, notification_id: null }],
      warning: 'permission',
      error: null,
    });
    expect(scheduleRows).not.toHaveBeenCalled();
  });

  it('returns a separate reminder error while preserving a saveable task', async () => {
    const task = { enabled: true, notification_id: null };
    const error = new Error('Notification scheduling failed');

    const result = await prepareTaskReminders(
      [task],
      async () => ({ granted: true }),
      async () => ({ data: null, error })
    );

    expect(result).toEqual({
      data: [{ enabled: false, notification_id: null }],
      warning: 'error',
      error,
    });
  });

  it('keeps scheduled reminders and warns if only some occurrences could be scheduled', async () => {
    const tasks = [
      { enabled: true, notification_id: 'notification-1' },
      { enabled: true, notification_id: null },
    ];

    const result = await prepareTaskReminders(
      tasks,
      async () => ({ granted: true }),
      async () => ({ data: tasks, error: null })
    );

    expect(result).toEqual({ data: tasks, warning: 'partial', error: null });
  });

  it('filters common date ranges and summarizes task statuses', () => {
    expect(matchesTaskDate('2026-10-06', 'tomorrow', '2026-10-05')).toBe(true);
    expect(summarizeTasks([{ status: 'pending', task_type: 'medicine' }, { status: 'completed', task_type: 'doctor_appointment' }, { status: 'skipped', task_type: 'health_checkup' }])).toEqual({
      total: 3, pending: 1, completed: 1, skipped: 1, medicine: 1, appointments: 1, checkups: 1,
    });
  });
});
