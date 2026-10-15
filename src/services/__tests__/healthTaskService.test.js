import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { supabase } from '../../lib/supabase';
import {
  insertHealthTasks,
  extendRecurringTasks,
  listHealthTaskHistory,
  listHealthTasks,
  removeHealthTask,
  updateHealthTask,
} from '../healthTaskService';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const USER_ID = 'user-1';
const TASK_ID = 'task-1';

function setUpQuery(response = { data: [], error: null }) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve(response)),
    then: (resolve, reject) => Promise.resolve(response).then(resolve, reject),
  };
  supabase.from.mockReturnValue(builder);
  supabase.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
  return builder;
}

describe('healthTaskService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('loads persisted tasks for the signed-in user and excludes soft-deleted rows', async () => {
    const builder = setUpQuery({ data: [{ id: TASK_ID }], error: null });

    const result = await listHealthTasks(USER_ID);

    expect(result.data).toEqual([{ id: TASK_ID }]);
    expect(supabase.from).toHaveBeenCalledWith('health_tasks');
    expect(builder.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(builder.is).toHaveBeenCalledWith('deleted_at', null);
    expect(builder.order).toHaveBeenNthCalledWith(1, 'task_date');
    expect(builder.order).toHaveBeenNthCalledWith(2, 'task_time');
  });

  it('persists a one-time task under the authenticated user', async () => {
    const builder = setUpQuery({ data: [{ id: TASK_ID }], error: null });
    const task = {
      title: 'Take medicine',
      task_date: '2026-10-15',
      task_time: '09:00',
      repeat_type: 'none',
      repeat_days: [],
      series_id: null,
      metadata: { details: { dosage: '1' } },
    };

    const result = await insertHealthTasks(USER_ID, [task]);

    expect(result.data).toEqual([{ id: TASK_ID }]);
    expect(builder.insert).toHaveBeenCalledWith([{ ...task, user_id: USER_ID }]);
    expect(builder.select).toHaveBeenCalled();
  });

  it.each([
    'medicine',
    'doctor_appointment',
    'health_checkup',
    'health_schedule',
  ])('persists a one-time task of type %s', async (taskType) => {
    const builder = setUpQuery({ data: [{ id: TASK_ID }], error: null });
    const task = {
      title: 'Health activity',
      task_type: taskType,
      status: 'pending',
      task_date: '2026-10-15',
      task_time: '09:00',
      repeat_type: 'none',
      repeat_days: [],
      enabled: false,
      notification_id: null,
      series_id: null,
      metadata: { details: {} },
    };

    const result = await insertHealthTasks(USER_ID, [task]);

    expect(result.error).toBeNull();
    expect(builder.insert).toHaveBeenCalledWith([{ ...task, user_id: USER_ID }]);
  });

  it.each(['daily', 'weekly', 'monthly'])(
    'persists %s recurring occurrences with their shared series and recurrence metadata',
    async (repeatType) => {
      const builder = setUpQuery({ data: [{ id: TASK_ID }], error: null });
      const task = {
        title: 'Take medicine',
        task_date: '2026-10-15',
        task_time: '09:00',
        repeat_type: repeatType,
        repeat_days: repeatType === 'weekly' ? [1, 3, 5] : [],
        series_id: `series-${repeatType}`,
        enabled: false,
        notification_id: null,
        metadata: {
          series_start_date: '2026-10-15',
          series_end_date: null,
          series_generation_until: '2026-10-15',
        },
      };

      const result = await insertHealthTasks(USER_ID, [task]);

      expect(result.error).toBeNull();
      expect(builder.insert).toHaveBeenCalledWith([{ ...task, user_id: USER_ID }]);
      expect(builder.select).toHaveBeenCalled();
    }
  );

  it('persists a recurring task with notifications enabled and no end date', async () => {
    const builder = setUpQuery({ data: [{ id: TASK_ID }], error: null });
    const task = {
      title: 'Take medicine',
      task_date: '2026-10-15',
      task_time: '12:50',
      repeat_type: 'daily',
      repeat_days: [],
      series_id: 'series-reminder-on',
      enabled: true,
      notification_id: 'notification-1',
      metadata: { series_end_date: null, series_generation_until: '2027-01-13' },
    };

    const result = await insertHealthTasks(USER_ID, [task]);

    expect(result.error).toBeNull();
    expect(builder.insert).toHaveBeenCalledWith([{ ...task, user_id: USER_ID }]);
  });

  it('persists task details, an optional empty end date, and reminder state', async () => {
    const builder = setUpQuery({ data: [{ id: TASK_ID }], error: null });
    const task = {
      title: 'Medicine',
      description: 'Take after food',
      task_type: 'medicine',
      task_date: '2026-10-15',
      task_time: '12:50',
      repeat_type: 'none',
      repeat_days: [],
      enabled: true,
      notification_id: 'notification-1',
      series_id: 'series-reminder-on',
      metadata: { details: { dosage: '1', notes: 'daily' }, series_end_date: null },
    };

    await insertHealthTasks(USER_ID, [task]);

    expect(builder.insert).toHaveBeenCalledWith([{ ...task, user_id: USER_ID }]);
  });

  it('logs Supabase permission errors and returns the original insert error', async () => {
    const error = { code: '42501', message: 'permission denied', details: 'RLS policy', hint: null };
    setUpQuery({ data: null, error });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await insertHealthTasks(USER_ID, [{ title: 'Medicine' }]);

    expect(result.error).toBe(error);
    expect(errorSpy).toHaveBeenCalledWith('[healthTaskService] Health task insert failed', {
      code: '42501',
      message: 'permission denied',
      details: 'RLS policy',
      hint: null,
      name: undefined,
    });
    errorSpy.mockRestore();
  });

  it('does not send an insert when no user is authenticated', async () => {
    setUpQuery();
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await insertHealthTasks(USER_ID, [{ title: 'Medicine' }]);

    expect(result.error.message).toBe('Not authorized');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('logs network failures and returns an error instead of reporting a successful insert', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    const error = new TypeError('Failed to fetch');
    supabase.from.mockImplementation(() => {
      throw error;
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await insertHealthTasks(USER_ID, [{ title: 'Medicine' }]);

    expect(result).toEqual({ data: null, error });
    expect(errorSpy).toHaveBeenCalledWith('[healthTaskService] Health task insert request failed', {
      code: undefined,
      message: 'Failed to fetch',
      details: undefined,
      hint: undefined,
      name: 'TypeError',
    });
    errorSpy.mockRestore();
  });

  it('does not schedule future notifications when a recurring reminder is disabled', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const dayBefore = new Date(today);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const toDate = (date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const queryResults = [
      { data: [], error: null },
      { data: [], error: null },
      { error: null },
    ];
    const queryBuilders = [];
    supabase.from.mockImplementation(() => {
      const response = queryResults[queryBuilders.length];
      const builder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        upsert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        then: (resolve, reject) => Promise.resolve(response).then(resolve, reject),
      };
      queryBuilders.push(builder);
      return builder;
    });
    const scheduleMissing = jest.fn();
    const sample = {
      id: TASK_ID,
      series_id: 'series-daily',
      user_id: USER_ID,
      task_date: toDate(dayBefore),
      task_time: '09:00',
      repeat_type: 'daily',
      repeat_days: [],
      enabled: false,
      notification_id: null,
      status: 'pending',
      completed_at: null,
      metadata: {
        series_end_date: toDate(tomorrow),
        series_generation_until: toDate(dayBefore),
      },
    };

    const result = await extendRecurringTasks(USER_ID, [sample], scheduleMissing);

    expect(result).toEqual({ data: true, error: null });
    expect(scheduleMissing).not.toHaveBeenCalled();
    expect(queryBuilders[1].upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ enabled: false, notification_id: null, series_id: 'series-daily' }),
      ]),
      { onConflict: 'series_id,task_date,task_time', ignoreDuplicates: true }
    );
  });

  it('persists edits scoped to the owner and active task', async () => {
    const builder = setUpQuery({ data: { id: TASK_ID, title: 'Updated' }, error: null });

    const result = await updateHealthTask(USER_ID, TASK_ID, { title: 'Updated' });

    expect(result.data.title).toBe('Updated');
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated', updated_at: expect.any(String) }));
    expect(builder.eq).toHaveBeenCalledWith('id', TASK_ID);
    expect(builder.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(builder.is).toHaveBeenCalledWith('deleted_at', null);
  });

  it('soft-deletes a task so it disappears from the list but remains auditable', async () => {
    const builder = setUpQuery({ error: null });

    const result = await removeHealthTask(USER_ID, TASK_ID);

    expect(result.error).toBeNull();
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({
      deleted_at: expect.any(String),
      enabled: false,
      notification_id: null,
    }));
    expect(builder.eq).toHaveBeenCalledWith('id', TASK_ID);
    expect(builder.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(builder.is).toHaveBeenCalledWith('deleted_at', null);
    expect(builder.select).toHaveBeenCalledWith('id');
    expect(builder.single).toHaveBeenCalled();
  });

  it('loads persistent audit events newest first for only the signed-in user', async () => {
    const event = { id: 'event-1', event_type: 'deleted', task_id: TASK_ID };
    const builder = setUpQuery({ data: [event], error: null });

    const result = await listHealthTaskHistory(USER_ID);

    expect(result.data).toEqual([event]);
    expect(supabase.from).toHaveBeenCalledWith('health_task_history');
    expect(builder.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(builder.order).toHaveBeenCalledWith('occurred_at', { ascending: false });
  });

  it('refuses to access another user’s health records', async () => {
    setUpQuery();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'different-user' } }, error: null });

    const result = await listHealthTasks(USER_ID);

    expect(result.error.message).toBe('Not authorized');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
