
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from '../lib/localNotifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getLanguageText } from '../utils/i18n';
import {
  dateKey,
  getOccurrenceDates,
  matchesTaskDate,
  prepareTaskReminders,
  summarizeTasks,
} from '../utils/healthTaskUtils';
import {
  insertHealthTasks,
  listHealthTasks,
  listHealthTaskHistory,
  removeHealthTask,
  updateHealthTask,
  extendRecurringTasks,
} from '../services/healthTaskService';

const BLUE = '#2F6FED';
const DARK = '#18365F';
const TYPES = ['medicine', 'doctor_appointment', 'health_checkup', 'health_schedule'];
const STATUSES = ['pending', 'completed', 'skipped'];
const REPEATS = ['none', 'daily', 'weekly', 'monthly'];
const TYPE_LABELS = {
  medicine: 'medicine',
  doctor_appointment: 'appointment',
  health_checkup: 'checkup',
  health_schedule: 'schedule',
};
const CATEGORY_LABELS = {
  medicine: '💊 ยา',
  doctor_appointment: '🩺 อาการ',
  health_checkup: '❤️ สุขภาพ',
  health_schedule: '📅 นัดหมาย',
};
const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const todayKey = () => dateKey(new Date());

function parseDateValue(value, fallback = new Date()) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(fallback);
  }

  const [year, month, day] = value.split('-').map(Number);
  const result = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return new Date(fallback);
  }

  return result;
}

function parseTimeValue(value) {
  if (!value || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return new Date(2000, 0, 1, 9, 0, 0, 0);
  }

  const [hour, minute] = value.split(':').map(Number);
  return new Date(2000, 0, 1, hour, minute, 0, 0);
}

async function cancelNotificationsSafely(notificationIds, context) {
  const results = await Promise.allSettled(
    notificationIds
      .filter(Boolean)
      .map((notificationId) =>
        Notifications.cancelScheduledNotificationAsync(notificationId)
      )
  );

  results.forEach((result) => {
    if (result.status === 'rejected') {
      console.warn(`[HealthTasksScreen] ${context}`, result.reason);
    }
  });
}

async function scheduleMissingNotifications(rows, reminderBody) {
  const scheduled = [];

  try {
    if (Notifications.supportsAndroidNotificationChannels()) {
      const channel = await Notifications.setAndroidNotificationChannel(
        'reminders',
        {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
        }
      );

      if (!channel) {
        throw new Error('Could not create the Android reminders channel.');
      }
    }

    const permission = await Notifications.getPermissionsAsync();

    if (!permission.granted) {
      return {
        data: rows.map((row) => ({ ...row, notification_id: null })),
        error: null,
      };
    }

    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const available = Math.max(0, 50 - existing.length);

    for (const [index, row] of rows.entries()) {
      if (index >= available) {
        scheduled.push({ ...row, notification_id: null });
        continue;
      }

      const triggerDate = new Date(
        `${row.task_date}T${row.task_time || '09:00'}:00`
      );

      if (!Number.isFinite(triggerDate.getTime()) || triggerDate <= new Date()) {
        scheduled.push({ ...row, notification_id: null });
        continue;
      }

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: row.title,
          body: row.description || reminderBody,
          data: {
            ...(row.id ? { healthTaskId: row.id } : {}),
            seriesId: row.series_id,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: 'reminders',
        },
      });

      scheduled.push({ ...row, notification_id: notificationId });
    }

    return { data: scheduled, error: null };
  } catch (scheduleError) {
    await cancelNotificationsSafely(
      scheduled.map((row) => row.notification_id),
      'Failed to cancel a partially scheduled reminder'
    );

    return { data: null, error: scheduleError };
  }
}

export default function HealthTasksScreen({
  userId,
  language = 'th',
  onBack,
}) {
  const t = useCallback(
    (key) =>
      getLanguageText(
        language,
        `task_${key}`,
        getLanguageText(language, key)
      ),
    [language]
  );

  const [tasks, setTasks] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('today');
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [month, setMonth] = useState(new Date());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customDate, setCustomDate] = useState(todayKey());
  const [formVisible, setFormVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const [historyDetail, setHistoryDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    const requestIsCurrent = () => requestId === loadRequestRef.current;

    setLoading(true);
    setError('');

    if (!userId) {
      setTasks([]);
      setHistoryEvents([]);
      setError(t('signInRequired'));
      setLoading(false);
      return;
    }

    try {
      const first = await listHealthTasks(userId);

      if (!requestIsCurrent()) return;

      if (first.error) {
        setError(first.error.message || t('loadFailed'));
        setLoading(false);
        return;
      }

      const extension = await extendRecurringTasks(
        userId,
        first.data || [],
        (rows) =>
          scheduleMissingNotifications(rows, t('task_taskReminderBody'))
      );

      if (!requestIsCurrent()) return;

      if (extension.error) {
        setError(extension.error.message || t('loadFailed'));
      }

      const latest = extension.data
        ? await listHealthTasks(userId)
        : first;

      if (!requestIsCurrent()) return;

      if (latest.error) {
        setError(latest.error.message || t('loadFailed'));
        setTasks(first.data || []);
      } else {
        const currentTime = new Date().toTimeString().slice(0, 5);

        const pendingReminders = (latest.data || []).filter(
          (task) =>
            task.enabled &&
            task.status === 'pending' &&
            !task.notification_id &&
            `${task.task_date} ${task.task_time || '09:00'}` >=
              `${todayKey()} ${currentTime}`
        );

        const scheduled = await scheduleMissingNotifications(
          pendingReminders,
          t('task_taskReminderBody')
        );

        if (!requestIsCurrent()) return;

        if (scheduled.data?.some((task) => task.notification_id)) {
          for (const task of scheduled.data.filter(
            (row) => row.notification_id
          )) {
            const saved = await updateHealthTask(userId, task.id, {
              notification_id: task.notification_id,
            });

            if (saved.error) {
              await cancelNotificationsSafely(
                [task.notification_id],
                'Failed to cancel a reminder after saving its task failed'
              );
            }
          }

          const refreshed = await listHealthTasks(userId);

          if (!requestIsCurrent()) return;

          if (refreshed.error) {
            setError(refreshed.error.message || t('loadFailed'));
          }

          setTasks(refreshed.data || latest.data || []);
        } else {
          setTasks(latest.data || []);
        }
      }

      const historyResult = await listHealthTaskHistory(userId);

      if (!requestIsCurrent()) return;

      if (historyResult.error) {
        setError(historyResult.error.message || t('historyLoadFailed'));
      } else {
        setHistoryEvents(historyResult.data || []);
      }
    } catch (loadError) {
      if (requestIsCurrent()) {
        console.error(
          '[HealthTasksScreen] Failed to load health tasks',
          loadError
        );
        setError(loadError.message || t('loadFailed'));
      }
    } finally {
      if (requestIsCurrent()) setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const todayTasks = useMemo(
    () => tasks.filter((task) => task.task_date === todayKey()),
    [tasks]
  );

  const visibleTasks = useMemo(() => {
    let source = tab === 'history' ? [] : tasks;

    if (tab === 'today') {
      source = source.filter((task) => task.task_date === todayKey());
    }

    if (tab === 'calendar') {
      source = source.filter((task) => task.task_date === selectedDate);
    }

    if (tab === 'all') {
      source = source.filter((task) =>
        dateFilter === 'custom'
          ? task.task_date === customDate
          : matchesTaskDate(task.task_date, dateFilter)
      );

      if (typeFilter !== 'all') {
        source = source.filter((task) => task.task_type === typeFilter);
      }

      if (statusFilter !== 'all') {
        source = source.filter((task) => task.status === statusFilter);
      }

      const term = search.trim().toLocaleLowerCase();

      if (term) {
        source = source.filter((task) =>
          [
            task.title,
            task.description,
            ...Object.values(task.metadata?.details || {}),
          ]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase()
            .includes(term)
        );
      }
    }

    return [...source].sort((a, b) =>
      `${a.task_date} ${a.task_time || ''}`.localeCompare(
        `${b.task_date} ${b.task_time || ''}`
      )
    );
  }, [
    tasks,
    tab,
    selectedDate,
    dateFilter,
    customDate,
    typeFilter,
    statusFilter,
    search,
  ]);

  const visibleHistory = useMemo(() => {
    if (tab !== 'history') return [];

    const term = search.trim().toLocaleLowerCase();

    return historyEvents.filter((event) => {
      const snapshot = event.after_data || event.before_data || {};
      const eventDate = event.occurred_at?.slice(0, 10);

      if (
        dateFilter === 'custom'
          ? eventDate !== customDate
          : !matchesTaskDate(eventDate, dateFilter)
      ) {
        return false;
      }

      if (typeFilter !== 'all' && snapshot.task_type !== typeFilter) {
        return false;
      }

      if (statusFilter !== 'all' && snapshot.status !== statusFilter) {
        return false;
      }

      if (!term) return true;

      return [
        snapshot.title,
        snapshot.description,
        event.event_type,
        JSON.stringify(snapshot.metadata?.details || {}),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(term);
    });
  }, [
    historyEvents,
    tab,
    search,
    dateFilter,
    customDate,
    typeFilter,
    statusFilter,
  ]);

  const weekTasks = useMemo(
    () => tasks.filter((task) => matchesTaskDate(task.task_date, 'week')),
    [tasks]
  );

  const monthTasks = useMemo(
    () => tasks.filter((task) => matchesTaskDate(task.task_date, 'month')),
    [tasks]
  );

  const todaySummary = summarizeTasks(todayTasks);
  const weekSummary = summarizeTasks(weekTasks);
  const missedThisWeek = weekTasks.filter(
    (task) => task.status === 'pending' && task.task_date < todayKey()
  ).length;
  const monthSummary = summarizeTasks(monthTasks);
  const monthRate = monthSummary.total
    ? Math.round((100 * monthSummary.completed) / monthSummary.total)
    : 0;

  const cancelTaskNotification = async (task) => {
    if (!task?.notification_id) return;

    await Notifications.cancelScheduledNotificationAsync(
      task.notification_id
    );
  };

  const setStatus = async (task, status) => {
    try {
      const completedAt =
        status === 'completed' ? new Date().toISOString() : null;

      const result = await updateHealthTask(userId, task.id, {
        status,
        completed_at: completedAt,
        enabled: status === 'pending' ? task.enabled : false,
        notification_id:
          status === 'pending' ? task.notification_id : null,
      });

      if (result.error) {
        setError(result.error.message || t('saveFailed'));
        return;
      }

      let notificationFailed = false;

      if (status !== 'pending') {
        try {
          await cancelTaskNotification(task);
        } catch (notificationError) {
          console.error(
            '[HealthTasksScreen] Status changed but its device notification could not be cancelled',
            notificationError
          );
          notificationFailed = true;
        }
      }

      setDetail(result.data);
      await load();

      if (notificationFailed) {
        setError(t('notificationCancelFailed'));
      }
    } catch (statusError) {
      console.error(
        '[HealthTasksScreen] Failed to change task status',
        statusError
      );
      setError(t('saveFailed'));
    }
  };

  const removeTask = async (task) => {
    try {
      const result = await removeHealthTask(userId, task.id);

      if (result.error) {
        setError(t('deleteFailed'));
        return;
      }

      let notificationFailed = false;

      try {
        await cancelTaskNotification(task);
      } catch (notificationError) {
        console.error(
          '[HealthTasksScreen] Task was deleted but its device notification could not be cancelled',
          notificationError
        );
        notificationFailed = true;
      }

      setDetail(null);
      await load();

      if (notificationFailed) {
        setError(t('notificationCancelFailed'));
      }
    } catch (deleteError) {
      console.error(
        '[HealthTasksScreen] Failed to delete health task',
        deleteError
      );
      setError(deleteError.message || t('deleteFailed'));
    }
  };

  const changeReminder = async (task, enabled) => {
    let newNotificationId = null;

    try {
      if (enabled) {
        const permission = await Notifications.requestPermissionsAsync();

        if (!permission.granted) {
          setError(t('notificationPermission'));
          return;
        }

        const triggerDate = new Date(
          `${task.task_date}T${task.task_time || '09:00'}:00`
        );

        if (triggerDate <= new Date()) {
          setError(t('invalidTime'));
          return;
        }

        const pendingCount =
          await Notifications.getAllScheduledNotificationsAsync();

        if (pendingCount.length >= 50) {
          setError(t('notificationCapacity'));
          return;
        }

        newNotificationId =
          await Notifications.scheduleNotificationAsync({
            content: {
              title: task.title,
              body: task.description || t('task_taskReminderBody'),
              data: { healthTaskId: task.id },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
              channelId: 'reminders',
            },
          });
      }

      const result = await updateHealthTask(userId, task.id, {
        enabled,
        notification_id: newNotificationId,
      });

      if (result.error) {
        if (newNotificationId) {
          await Notifications.cancelScheduledNotificationAsync(
            newNotificationId
          );
        }

        setError(t('saveFailed'));
        return;
      }

      let notificationFailed = false;

      if (task.notification_id) {
        try {
          await cancelTaskNotification(task);
        } catch (notificationError) {
          console.error(
            '[HealthTasksScreen] Reminder setting changed but the old device notification could not be cancelled',
            notificationError
          );
          notificationFailed = true;
        }
      }

      setDetail(result.data);
      await load();

      if (notificationFailed) {
        setError(t('notificationCancelFailed'));
      }
    } catch (reminderError) {
      if (newNotificationId) {
        await cancelNotificationsSafely(
          [newNotificationId],
          'Failed to cancel a reminder after updating its task failed'
        );
      }

      console.error(
        '[HealthTasksScreen] Failed to update task reminder',
        reminderError
      );
      setError(reminderError.message || t('saveFailed'));
    }
  };

  const saveTask = async (draft) => {
    setError('');
    let scheduledNotifications = [];

    try {
      if (!draft.title.trim()) {
        setError(t('titleRequired'));
        return false;
      }

      const parsedDate = parseDateValue(draft.task_date);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(draft.task_date) ||
        dateKey(parsedDate) !== draft.task_date
      ) {
        setError(t('invalidDate'));
        return false;
      }

      if (draft.end_date) {
        const parsedEndDate = parseDateValue(draft.end_date);

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(draft.end_date) ||
          dateKey(parsedEndDate) !== draft.end_date ||
          draft.end_date < draft.task_date
        ) {
          setError(t('invalidEndDate'));
          return false;
        }
      }

      if (
        draft.task_time &&
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.task_time)
      ) {
        setError(t('invalidTime'));
        return false;
      }

      if (draft.task_type === 'medicine' && !draft.task_time) {
        setError(t('medicineTimeRequired'));
        return false;
      }

      if (
        draft.repeat_type === 'weekly' &&
        !draft.repeat_days.length
      ) {
        setError(t('selectWeekday'));
        return false;
      }

      const details = Object.fromEntries(
        Object.entries(draft.details).filter(
          ([, value]) => typeof value === 'string' && value.trim()
        )
      );

      const description = draft.description.trim() || null;

      if (editing) {
        let notificationId = null;
        let reminderEnabled = draft.reminder;
        let reminderWarningKey = null;

        if (draft.reminder) {
          const reminder = await prepareTaskReminders(
            [
              {
                ...editing,
                title: draft.title.trim(),
                description,
                task_date: draft.task_date,
                task_time: draft.task_time || '09:00',
                metadata: { ...editing.metadata, details },
                enabled: true,
              },
            ],
            () => Notifications.requestPermissionsAsync(),
            (rows) =>
              scheduleMissingNotifications(rows, t('task_taskReminderBody'))
          );

          if (reminder.error) {
            console.error(
              '[HealthTasksScreen] Reminder setup failed while updating a health task',
              {
                name: reminder.error.name,
                message: reminder.error.message,
              }
            );
          }

          notificationId = reminder.data[0]?.notification_id || null;
          reminderEnabled = Boolean(notificationId);
          if (notificationId) scheduledNotifications = [notificationId];
          reminderWarningKey = reminder.warning
            ? `task_savedWithoutReminder${reminder.warning[0].toUpperCase()}${reminder.warning.slice(1)}`
            : null;
        }

        const updated = await updateHealthTask(userId, editing.id, {
          title: draft.title.trim(),
          description,
          task_type: draft.task_type,
          task_date: draft.task_date,
          task_time: draft.task_time || '09:00',
          repeat_type: draft.repeat_type,
          repeat_days: draft.repeat_days,
          metadata: { ...editing.metadata, details },
          enabled: reminderEnabled,
          notification_id: notificationId,
        });

        if (updated.error) {
          if (notificationId) {
            await cancelNotificationsSafely(
              [notificationId],
              'Failed to cancel a reminder after updating a task failed'
            );
          }

          setError(t('saveFailed'));
          return false;
        }

        let notificationFailed = Boolean(reminderWarningKey);

        if (editing.notification_id && (!reminderEnabled || notificationId !== editing.notification_id)) {
          try {
            await cancelTaskNotification(editing);
          } catch (notificationError) {
            console.error(
              '[HealthTasksScreen] Task was updated but the old device notification could not be cancelled',
              notificationError
            );
            notificationFailed = true;
          }
        }

        setEditing(null);
        setFormVisible(false);
        setDetail(updated.data);
        await load();

        if (notificationFailed && !reminderWarningKey) {
          setError(t('notificationCancelFailed'));
        }

        Alert.alert(
          t('saved'),
          reminderWarningKey
            ? t(reminderWarningKey)
            : notificationFailed
              ? t('taskUpdatedNotificationWarning')
              : t('taskUpdated')
        );

        return true;
      }

      const start = draft.task_date;
      let through = dateKey(new Date(Date.now() + 90 * 86400000));

      if (draft.end_date && draft.end_date < through) {
        through = draft.end_date;
      }

      if (draft.repeat_type === 'none') {
        through = start;
      }

      const dates = getOccurrenceDates({
        startDate:
          draft.repeat_type === 'none' || start >= todayKey()
            ? start
            : todayKey(),
        endDate: draft.end_date || null,
        repeatType: draft.repeat_type,
        repeatDays: draft.repeat_days,
        throughDate: through,
      });

      if (!dates.length) {
        setError(t('noTaskDates'));
        return false;
      }

      const seriesId =
        draft.repeat_type === 'none'
          ? null
          : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
              /[xy]/g,
              (character) => {
                const random = Math.floor(Math.random() * 16);
                return (
                  character === 'x'
                    ? random
                    : (random & 0x3) | 0x8
                ).toString(16);
              }
            );

      const metadata = draft.repeat_type === 'none'
        ? { details }
        : {
            details,
            series_start_date: start,
            series_end_date: draft.end_date || null,
            series_generation_until: through,
          };

      const rows = dates.map((taskDate) => ({
        series_id: seriesId,
        title: draft.title.trim(),
        description,
        task_type: draft.task_type,
        status: 'pending',
        task_date: taskDate,
        task_time: draft.task_time || '09:00',
        repeat_type: draft.repeat_type,
        repeat_days: draft.repeat_days,
        enabled: draft.reminder,
        completed_at: null,
        notification_id: null,
        metadata,
      }));

      let scheduled = rows;
      let reminderWarningKey = null;

      if (draft.reminder) {
        const reminder = await prepareTaskReminders(
          rows,
          () => Notifications.requestPermissionsAsync(),
          (reminderRows) =>
            scheduleMissingNotifications(
              reminderRows,
              t('task_taskReminderBody')
            )
        );

        if (reminder.error) {
          console.error(
            '[HealthTasksScreen] Reminder setup failed while creating a health task',
            {
              name: reminder.error.name,
              message: reminder.error.message,
            }
          );
        }

        scheduled = reminder.data;
        scheduledNotifications = scheduled
          .map((task) => task.notification_id)
          .filter(Boolean);
        reminderWarningKey = reminder.warning
          ? `task_savedWithoutReminder${reminder.warning[0].toUpperCase()}${reminder.warning.slice(1)}`
          : null;
      }

      const result = await insertHealthTasks(userId, scheduled);

      if (result.error) {
        await cancelNotificationsSafely(
          scheduledNotifications,
          'Failed to cancel reminders after saving tasks failed'
        );

        scheduledNotifications = [];
        setError(t('saveFailed'));
        return false;
      }

      setFormVisible(false);
      await load();

      Alert.alert(
        t('saved'),
        reminderWarningKey ? t(reminderWarningKey) : t('taskSaved')
      );

      return true;
    } catch (saveError) {
      await cancelNotificationsSafely(
        scheduledNotifications,
        'Failed to cancel reminders while handling a task save error'
      );

      console.error(
        '[HealthTasksScreen] Failed to save health task',
        saveError
      );
      setError(saveError.message || t('saveFailed'));
      return false;
    }
  };

  const startEdit = (task) => {
    setEditing(task);
    setDetail(null);
    setFormVisible(true);
  };

  const tabButtons = ['today', 'calendar', 'all', 'history'];

 const statusLabel = {
    pending: 'pending',
    completed: 'completed',
    skipped: 'skipped',
  };

  const typeIcon = {
    medicine: 'pill',
    doctor_appointment: 'hospital-building',
    health_checkup: 'stethoscope',
    health_schedule: 'calendar-check',
  };

  const changeMonth = (amount) =>
    setMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + amount, 1)
    );

  const monthGrid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);

      return {
        date: dateKey(day),
        inMonth: day.getMonth() === month.getMonth(),
      };
    });
  }, [month]);

  const countsByDate = useMemo(
    () =>
      tasks.reduce((acc, task) => {
        acc[task.task_date] = (acc[task.task_date] || 0) + 1;
        return acc;
      }, {}),
    [tasks]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.back}>
          <Ionicons name="arrow-back" size={22} color={DARK} />
        </Pressable>

        <Text style={styles.headerTitle}>{t('healthTasks')}</Text>

        <Pressable
          onPress={() => {
            setEditing(null);
            setFormVisible(true);
          }}
          style={styles.addIcon}
        >
          <Ionicons name="add" size={26} color="#fff" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.tabs}>
          {tabButtons.map((name) => (
            <Pressable
              key={name}
              onPress={() => setTab(name)}
              style={[styles.tab, tab === name && styles.activeTab]}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === name && styles.activeTabText,
                ]}
              >
                {t(name)}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'today' ? (
          <>
            <View style={styles.todayCard}>
              <Text style={styles.todayHeading}>{t('today')}</Text>

              <Text style={styles.dateText}>
                {new Date(`${todayKey()}T12:00:00`).toLocaleDateString(
                  language === 'en' ? 'en-US' : 'th-TH',
                  {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }
                )}
              </Text>

              <View style={styles.metrics}>
                {[
                  ['total', todaySummary.total],
                  ['pending', todaySummary.pending],
                  ['completed', todaySummary.completed],
                  ['skipped', todaySummary.skipped],
                ].map(([key, value]) => (
                  <View style={styles.metric} key={key}>
                    <Text style={styles.metricNumber}>{value}</Text>
                    <Text style={styles.metricLabel}>{t(key)}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>{t('todayTasks')}</Text>
              <Text style={styles.count}>{todayTasks.length}</Text>
            </View>
          </>
        ) : null}

        {tab === 'calendar' ? (
          <>
            <View style={styles.monthHeader}>
              <Pressable onPress={() => changeMonth(-1)}>
                <Ionicons name="chevron-back" color={BLUE} size={22} />
              </Pressable>

              <Text style={styles.monthTitle}>
                {month.toLocaleDateString(
                  language === 'en' ? 'en-US' : 'th-TH',
                  { month: 'long', year: 'numeric' }
                )}
              </Text>

              <Pressable onPress={() => changeMonth(1)}>
                <Ionicons name="chevron-forward" color={BLUE} size={22} />
              </Pressable>
            </View>

            <View style={styles.calendarGrid}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={styles.weekday}>
                  {t(day).slice(0, 2)}
                </Text>
              ))}

              {monthGrid.map(({ date, inMonth }) => (
                <Pressable
                  key={date}
                  onPress={() => setSelectedDate(date)}
                  style={[
                    styles.dayCell,
                    !inMonth && styles.otherMonth,
                    selectedDate === date && styles.selectedDay,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      selectedDate === date && styles.selectedDayText,
                    ]}
                  >
                    {Number(date.slice(-2))}
                  </Text>

                  {countsByDate[date] ? (
                    <View
                      style={[
                        styles.indicator,
                        selectedDate === date && styles.selectedIndicator,
                      ]}
                    />
                  ) : null}
                </Pressable>
              ))}
            </View>

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>{selectedDate}</Text>
              <Text style={styles.count}>{visibleTasks.length}</Text>
            </View>
          </>
        ) : null}

        {tab === 'all' || tab === 'history' ? (
          <>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color="#8B9AB2" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('search')}
                style={styles.searchInput}
              />
            </View>

            <Text style={styles.filterLabel}>{t('typeFilter')}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['all', ...TYPES].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setTypeFilter(value)}
                  style={[
                    styles.chip,
                    typeFilter === value && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      typeFilter === value && styles.chipTextActive,
                    ]}
                  >
                    {t(value === 'all' ? 'all' : TYPE_LABELS[value])}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>{t('statusFilter')}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['all', ...STATUSES].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setStatusFilter(value)}
                  style={[
                    styles.chip,
                    statusFilter === value && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      statusFilter === value && styles.chipTextActive,
                    ]}
                  >
                    {t(value)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.filterLabel}>{t('dateFilter')}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {['all', 'today', 'tomorrow', 'week', 'month', 'custom'].map(
                (value) => (
                  <Pressable
                    key={value}
                    onPress={() => setDateFilter(value)}
                    style={[
                      styles.chip,
                      dateFilter === value && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        dateFilter === value && styles.chipTextActive,
                      ]}
                    >
                      {t(value)}
                    </Text>
                  </Pressable>
                )
              )}
            </ScrollView>

            {dateFilter === 'custom' ? (
              <DateTimeField
                label={t('customDate')}
                mode="date"
                value={customDate}
                onChange={setCustomDate}
              />
            ) : null}

            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>{t(tab)}</Text>
              <Text style={styles.count}>
                {tab === 'history'
                  ? visibleHistory.length
                  : visibleTasks.length}
              </Text>
            </View>
          </>
        ) : null}

        {tab === 'today' || tab === 'calendar' ? (
          <View style={{ marginTop: 4 }} />
        ) : null}

        {loading ? (
          <ActivityIndicator color={BLUE} style={{ marginTop: 28 }} />
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading &&
        tab !== 'history' &&
        visibleTasks.length === 0 ? (
          <Text style={styles.empty}>{t('noTasks')}</Text>
        ) : null}

        {!loading &&
        tab === 'history' &&
        visibleHistory.length === 0 ? (
          <Text style={styles.empty}>{t('noHistoryEvents')}</Text>
        ) : null}

        {!loading && tab === 'history'
          ? visibleHistory.map((event) => {
              const snapshot =
                event.after_data || event.before_data || {};

              return (
                <Pressable
                  key={event.id}
                  style={styles.taskCard}
                  onPress={() => setHistoryDetail(event)}
                >
                  <View style={styles.taskIcon}>
                    <MaterialCommunityIcons
                      name={
                        event.event_type === 'deleted'
                          ? 'delete-outline'
                          : 'history'
                      }
                      size={22}
                      color={BLUE}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.taskType}>
                      {t(`${event.event_type}Event`)}
                    </Text>

                    <Text style={styles.taskTitle}>
                      {snapshot.title || t('deletedTask')}
                    </Text>

                    <Text style={styles.taskSub}>
                      {new Date(event.occurred_at).toLocaleString(
                        language === 'en' ? 'en-US' : 'th-TH'
                      )}
                    </Text>

                    {snapshot.task_date ? (
                      <Text style={styles.taskSub}>
                        {snapshot.task_date}{' '}
                        {snapshot.task_time?.slice(0, 5) || ''}
                      </Text>
                    ) : null}
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color="#9AA8BA"
                  />
                </Pressable>
              );
            })
          : null}

        {!loading
          ? visibleTasks.map((task) => (
              <Pressable
                key={task.id}
                style={styles.taskCard}
                onPress={() => setDetail(task)}
              >
                <View style={styles.taskIcon}>
                  <MaterialCommunityIcons
                    name={typeIcon[task.task_type] || 'calendar-check'}
                    size={24}
                    color={BLUE}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.taskType}>
                    {CATEGORY_LABELS[task.task_type] || t(TYPE_LABELS[task.task_type] || task.task_type)}
                  </Text>

                  <Text style={styles.taskTitle}>{task.title}</Text>

                  <Text style={styles.taskSub}>
                    {task.task_time
                      ? task.task_time.slice(0, 5)
                      : t('noTime')}
                    {task.description ? ` · ${task.description}` : ''}
                  </Text>

                  {task.notification_id ? (
                    <Text style={styles.reminder}>
                      <Ionicons
                        name="notifications-outline"
                        size={14}
                        color={BLUE}
                      />{' '}
                      {t('reminderOn')}
                    </Text>
                  ) : null}
                </View>

                <Pressable
                  onPress={(event) => {
                    event.stopPropagation();

                    setStatus(
                      task,
                      task.status === 'pending'
                        ? 'completed'
                        : task.status === 'completed'
                          ? 'skipped'
                          : 'pending'
                    );
                  }}
                  style={[
                    styles.badge,
                    styles[`badge_${task.status}`],
                  ]}
                >
                  <Text style={styles.badgeText}>
                    {t(statusLabel[task.status] || task.status)}
                  </Text>
                </Pressable>
              </Pressable>
            ))
          : null}

        <View style={styles.progressCard}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{t('healthProgress')}</Text>
            <Text style={styles.progressPercent}>{monthRate}%</Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${monthRate}%` },
              ]}
            />
          </View>

          <Text style={styles.taskSub}>
            {t('monthlyProgress')
              .replace('{done}', String(monthSummary.completed))
              .replace('{total}', String(monthSummary.total))}
          </Text>

          <View style={styles.periodStats}>
            <Text style={styles.taskSub}>
              {t('weekSummary')
                .replace('{total}', String(weekSummary.total))
                .replace('{done}', String(weekSummary.completed))
                .replace('{missed}', String(missedThisWeek))}
            </Text>

            <Text style={styles.taskSub}>
              {t('monthTypes')
                .replace('{medicine}', String(monthSummary.medicine))
                .replace('{appointments}', String(monthSummary.appointments))
                .replace('{checkups}', String(monthSummary.checkups))}
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.fab}
          onPress={() => {
            setEditing(null);
            setFormVisible(true);
          }}
        >
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>{t('addTask')}</Text>
        </Pressable>
      </ScrollView>

      <TaskForm
        visible={formVisible}
        initial={editing}
        language={language}
        errorMessage={error}
        onClose={() => {
          setFormVisible(false);
          setEditing(null);
          setError('');
        }}
        onSave={saveTask}
        onUnexpectedError={(formError) => {
          console.error(
            '[HealthTasksScreen] Health task form failed',
            formError
          );
          setError(formError.message || t('saveFailed'));
        }}
      />

      <TaskDetail
        task={detail}
        language={language}
        errorMessage={error}
        onClose={() => setDetail(null)}
        onStatus={setStatus}
        onEdit={startEdit}
        onDelete={removeTask}
        onReminder={changeReminder}
      />

      <TaskHistoryDetail
        event={historyDetail}
        language={language}
        onClose={() => setHistoryDetail(null)}
      />
    </SafeAreaView>
  );
}

function TaskForm({
  visible,
  initial,
  language,
  onClose,
  onSave,
  onUnexpectedError,
  errorMessage,
}) {
  const t = (key) =>
    getLanguageText(
      language,
      `task_${key}`,
      getLanguageText(language, key)
    );

  const [draft, setDraft] = useState(blankDraft());
  const [saving, setSaving] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setDraft(
        initial
          ? {
              task_type: initial.task_type,
              title: initial.title,
              task_date: initial.task_date,
              task_time: initial.task_time?.slice(0, 5) || '',
              repeat_type: initial.repeat_type,
              repeat_days: initial.repeat_days || [],
              end_date: initial.metadata?.series_end_date || '',
              description: initial.description || '',
              details: initial.metadata?.details || {},
              reminder: Boolean(initial.enabled),
            }
          : blankDraft()
      );
    }
  }, [visible, initial]);

  const update = (key, value) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const updateDetail = (key, value) =>
    setDraft((current) => ({
      ...current,
      details: { ...current.details, [key]: value },
    }));

  const toggleWeekday = (day) => {
    const dayNumber = WEEKDAYS.indexOf(day) + 1;

    update(
      'repeat_days',
      draft.repeat_days.includes(dayNumber)
        ? draft.repeat_days.filter((value) => value !== dayNumber)
        : [...draft.repeat_days, dayNumber].sort()
    );
  };

  const submit = async () => {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setSaving(true);

    try {
      const ok = await onSave(draft);

      if (ok) {
        setDraft(blankDraft());
      }
    } catch (submitError) {
      onUnexpectedError(submitError);
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  const extraFields =
    draft.task_type === 'medicine'
      ? [
          ['dosage', 'dosage'],
          ['notes', 'notes'],
        ]
      : draft.task_type === 'doctor_appointment'
        ? [
            ['hospital', 'hospital'],
            ['doctor', 'doctor'],
            ['location', 'location'],
            ['details', 'details'],
            ['notes', 'notes'],
          ]
        : draft.task_type === 'health_checkup'
          ? [
              ['checkupName', 'checkup'],
              ['location', 'location'],
              ['details', 'details'],
              ['notes', 'notes'],
            ]
          : [
              ['details', 'details'],
              ['notes', 'notes'],
            ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={formStyles.safe}>
        <View style={formStyles.header}>
          <Pressable onPress={onClose}>
            <Text style={formStyles.link}>{t('cancel')}</Text>
          </Pressable>

          <Text style={formStyles.heading}>
            {initial ? t('editTask') : t('addTask')}
          </Text>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={formStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={formStyles.label}>{t('typeFilter')}</Text>

          <View style={formStyles.typeGrid}>
            {TYPES.map((type) => (
              <Pressable
                key={type}
                onPress={() => update('task_type', type)}
                style={[
                  formStyles.typeButton,
                  draft.task_type === type && formStyles.selectedType,
                ]}
              >
                <Text
                  style={[
                    formStyles.typeText,
                    draft.task_type === type &&
                      formStyles.selectedTypeText,
                  ]}
                >
                  {CATEGORY_LABELS[type] || t(TYPE_LABELS[type] || type)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field
            label={t('title')}
            value={draft.title}
            onChangeText={(value) => update('title', value)}
          />

          {extraFields.map(([key]) => (
            <Field
              key={key}
              label={t(key)}
              value={draft.details[key] || ''}
              onChangeText={(value) => updateDetail(key, value)}
            />
          ))}

          <Field
            label={t('description')}
            value={draft.description}
            onChangeText={(value) => update('description', value)}
            multiline
          />

          <View style={formStyles.row}>
            <View style={{ flex: 1 }}>
              <DateTimeField
                label={t('date')}
                mode="date"
                value={draft.task_date}
                onChange={(value) => update('task_date', value)}
              />
            </View>

            <View style={{ flex: 1 }}>
              <DateTimeField
                label={t('time')}
                mode="time"
                value={draft.task_time}
                onChange={(value) => update('task_time', value)}
              />
            </View>
          </View>

          <DateTimeField
            label={t('endDate')}
            mode="date"
            value={draft.end_date}
            onChange={(value) => update('end_date', value)}
            allowClear
          />

          <Text style={formStyles.label}>{t('repeat')}</Text>

          <View style={formStyles.row}>
            {REPEATS.map((repeat) => (
              <Pressable
                key={repeat}
                onPress={() => update('repeat_type', repeat)}
                style={[
                  formStyles.chip,
                  draft.repeat_type === repeat &&
                    formStyles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    formStyles.chipText,
                    draft.repeat_type === repeat &&
                      formStyles.chipTextSelected,
                  ]}
                >
                  {t(repeat)}
                </Text>
              </Pressable>
            ))}
          </View>

          {draft.repeat_type === 'weekly' ? (
            <View style={formStyles.rowWrap}>
              {WEEKDAYS.map((day) => (
                <Pressable
                  key={day}
                  onPress={() => toggleWeekday(day)}
                  style={[
                    formStyles.chip,
                    draft.repeat_days.includes(
                      WEEKDAYS.indexOf(day) + 1
                    ) && formStyles.chipSelected,
                  ]}
                >
                  <Text
                    style={[
                      formStyles.chipText,
                      draft.repeat_days.includes(
                        WEEKDAYS.indexOf(day) + 1
                      ) && formStyles.chipTextSelected,
                    ]}
                  >
                    {t(day)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={formStyles.reminderRow}>
            <Text style={formStyles.label}>{t('setReminder')}</Text>
            <Switch
              value={draft.reminder}
              onValueChange={(value) => update('reminder', value)}
              trackColor={{ true: '#A9C4FA' }}
              thumbColor={BLUE}
            />
          </View>

          {errorMessage ? (
            <Text style={formStyles.error}>{errorMessage}</Text>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={saving}
            style={formStyles.save}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={formStyles.saveText}>
                {initial ? t('save') : t('addTask')}
              </Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function blankDraft() {
  return {
    task_type: 'medicine',
    title: '',
    task_date: todayKey(),
    task_time: '09:00',
    repeat_type: 'none',
    repeat_days: [],
    end_date: '',
    description: '',
    details: {},
    reminder: true,
  };
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}) {
  return (
    <View style={formStyles.field}>
      <Text style={formStyles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline={multiline}
        style={[
          formStyles.input,
          multiline && {
            minHeight: 76,
            textAlignVertical: 'top',
          },
        ]}
      />
    </View>
  );
}

function DateTimeField({
  label,
  mode = 'date',
  value,
  onChange,
  allowClear = false,
}) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const parsedValue =
    mode === 'time'
      ? parseTimeValue(value)
      : parseDateValue(value || todayKey());

  const displayValue =
    mode === 'time'
      ? value || ''
      : value || '';

  const onPickerChange = (event, selectedValue) => {
    if (Platform.OS !== 'ios') {
      setPickerVisible(false);
    }

    if (event?.type === 'dismissed' || !selectedValue) {
      return;
    }

    if (mode === 'time') {
      const hours = String(selectedValue.getHours()).padStart(2, '0');
      const minutes = String(selectedValue.getMinutes()).padStart(2, '0');
      onChange(`${hours}:${minutes}`);
    } else {
      onChange(dateKey(selectedValue));
    }
  };

  return (
    <View style={formStyles.field}>
      <Text style={formStyles.label}>{label}</Text>

      <View style={formStyles.dateTimeRow}>
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={formStyles.dateTimeButton}
        >
          <Ionicons
            name={mode === 'time' ? 'time-outline' : 'calendar-outline'}
            size={18}
            color={BLUE}
          />

          <Text
            style={[
              formStyles.dateTimeText,
              !displayValue && formStyles.placeholderText,
            ]}
          >
            {displayValue ||
              (mode === 'time' ? 'HH:mm' : 'YYYY-MM-DD')}
          </Text>

          <Ionicons name="chevron-down" size={16} color="#8B9AB2" />
        </Pressable>

        {allowClear && value ? (
          <Pressable
            onPress={() => onChange('')}
            style={formStyles.clearDateButton}
          >
            <Ionicons name="close-circle" size={20} color="#8B9AB2" />
          </Pressable>
        ) : null}
      </View>

      {pickerVisible && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parsedValue}
          mode={mode}
          display="default"
          onChange={onPickerChange}
        />
      ) : null}

      {pickerVisible && Platform.OS === 'ios' ? (
        <Modal
          transparent
          animationType="fade"
          onRequestClose={() => setPickerVisible(false)}
        >
          <View style={formStyles.pickerOverlay}>
            <View style={formStyles.pickerCard}>
              <View style={formStyles.pickerHeader}>
                <Pressable onPress={() => setPickerVisible(false)}>
                  <Text style={formStyles.link}>{'ยกเลิก'}</Text>
                </Pressable>

                <Pressable onPress={() => setPickerVisible(false)}>
                  <Text style={formStyles.link}>{'เสร็จสิ้น'}</Text>
                </Pressable>
              </View>

              <DateTimePicker
                value={parsedValue}
                mode={mode}
                display="spinner"
                onChange={onPickerChange}
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function TaskDetail({
  task,
  language,
  errorMessage,
  onClose,
  onStatus,
  onEdit,
  onDelete,
  onReminder,
}) {
  const t = (key) =>
    getLanguageText(
      language,
      `task_${key}`,
      getLanguageText(language, key)
    );

  return (
    <Modal
      visible={Boolean(task)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={detailStyles.overlay}>
        <View style={detailStyles.card}>
          <View style={detailStyles.top}>
            <Text style={detailStyles.title}>{task?.title}</Text>

            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color="#788BA5" />
            </Pressable>
          </View>

          {task ? (
            <ScrollView>
              <Text style={detailStyles.subtitle}>
                {t(task.task_type)} · {task.task_date}{' '}
                {task.task_time?.slice(0, 5) || ''}
              </Text>

              {task.description ? (
                <Text style={detailStyles.body}>{task.description}</Text>
              ) : null}

              {Object.entries(task.metadata?.details || {}).map(
                ([key, value]) => (
                  <Text key={key} style={detailStyles.body}>
                    {t(key)}: {value}
                  </Text>
                )
              )}

              <Text style={detailStyles.label}>{t('statusFilter')}</Text>

              <View style={formStyles.row}>
                {STATUSES.map((status) => (
                  <Pressable
                    key={status}
                    onPress={() => onStatus(task, status)}
                    style={[
                      formStyles.chip,
                      task.status === status &&
                        formStyles.chipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        formStyles.chipText,
                        task.status === status &&
                          formStyles.chipTextSelected,
                      ]}
                    >
                      {t(status)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={detailStyles.reminder}>
                <Text style={detailStyles.body}>{t('setReminder')}</Text>

                <Switch
                  value={Boolean(task.enabled)}
                  onValueChange={(value) => onReminder(task, value)}
                  trackColor={{ true: '#A9C4FA' }}
                  thumbColor={BLUE}
                />
              </View>

              {errorMessage ? (
                <Text style={formStyles.error}>{errorMessage}</Text>
              ) : null}

              <View style={formStyles.row}>
                <Pressable
                  onPress={() => onEdit(task)}
                  style={detailStyles.action}
                >
                  <Text style={detailStyles.actionText}>
                    {t('editTask')}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    Alert.alert(
                      t('deleteTask'),
                      t('deleteConfirm'),
                      [
                        { text: t('cancel'), style: 'cancel' },
                        {
                          text: t('deleteTask'),
                          style: 'destructive',
                          onPress: () => onDelete(task),
                        },
                      ]
                    )
                  }
                  style={[detailStyles.action, detailStyles.danger]}
                >
                  <Text style={detailStyles.actionText}>
                    {t('deleteTask')}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function TaskHistoryDetail({ event, language, onClose }) {
  const t = (key) =>
    getLanguageText(
      language,
      `task_${key}`,
      getLanguageText(language, key)
    );

  const renderSnapshot = (snapshot) => {
    if (!snapshot) {
      return (
        <Text style={detailStyles.body}>{t('notApplicable')}</Text>
      );
    }

    const fields = [
      ['title', t('title')],
      ['task_type', t('typeFilter')],
      ['status', t('statusFilter')],
      ['task_date', t('date')],
      ['task_time', t('time')],
      ['repeat_type', t('repeat')],
      ['enabled', t('setReminder')],
      ['description', t('description')],
    ];

    return fields
      .filter(
        ([key]) => snapshot[key] !== null && snapshot[key] !== undefined
      )
      .map(([key, label]) => {
        const rawValue = snapshot[key];

        const value =
          key === 'task_type' ||
          key === 'status' ||
          key === 'repeat_type'
            ? t(rawValue)
            : key === 'enabled'
              ? rawValue
                ? t('enabled')
                : t('disabled')
              : key === 'task_time'
                ? String(rawValue).slice(0, 5)
                : String(rawValue);

        return (
          <Text key={key} style={detailStyles.body}>
            {label}: {value}
          </Text>
        );
      })
      .concat(
        snapshot.metadata?.details
          ? [
              <Text key="details" style={detailStyles.body}>
                {t('details')}:{' '}
                {Object.entries(snapshot.metadata.details)
                  .map(([key, value]) => `${t(key)}: ${value}`)
                  .join(' · ')}
              </Text>,
            ]
          : []
      );
  };

  return (
    <Modal
      visible={Boolean(event)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={detailStyles.overlay}>
        <View style={detailStyles.card}>
          <View style={detailStyles.top}>
            <Text style={detailStyles.title}>
              {event ? t(`${event.event_type}Event`) : ''}
            </Text>

            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color="#788BA5" />
            </Pressable>
          </View>

          {event ? (
            <ScrollView>
              <Text style={detailStyles.subtitle}>
                {new Date(event.occurred_at).toLocaleString(
                  language === 'en' ? 'en-US' : 'th-TH'
                )}
              </Text>

              <Text style={detailStyles.label}>{t('beforeChange')}</Text>
              {renderSnapshot(event.before_data)}

              <Text style={detailStyles.label}>{t('afterChange')}</Text>
              {renderSnapshot(event.after_data)}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F8FC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  back: { width: 36 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: DARK,
  },
  addIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: 16, paddingBottom: 96 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E9EFF8',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  activeTab: { backgroundColor: '#fff', elevation: 1 },
  tabText: { fontSize: 12, color: '#70829B', fontWeight: '600' },
  activeTabText: { color: BLUE },
  todayCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
  },
  todayHeading: { color: DARK, fontSize: 24, fontWeight: '800' },
  dateText: { color: '#7386A0', marginTop: 3 },
  metrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  metric: { alignItems: 'center', minWidth: 62 },
  metricNumber: { fontSize: 22, fontWeight: '800', color: DARK },
  metricLabel: { fontSize: 11, color: '#72849D' },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  sectionTitle: {
    flex: 1,
    color: DARK,
    fontSize: 17,
    fontWeight: '800',
  },
  count: { color: BLUE, fontWeight: '700' },
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 13,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  taskIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskType: { color: BLUE, fontSize: 11, fontWeight: '700' },
  taskTitle: {
    color: DARK,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
  },
  taskSub: { color: '#7B8CA4', fontSize: 12, marginTop: 4 },
  reminder: { color: BLUE, fontSize: 11, marginTop: 5 },
  badge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 },
  badge_pending: { backgroundColor: '#FFF2D9' },
  badge_completed: { backgroundColor: '#E1F7EC' },
  badge_skipped: { backgroundColor: '#EEF0F4' },
  badgeText: { color: DARK, fontSize: 10, fontWeight: '700' },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  monthTitle: { fontSize: 16, fontWeight: '800', color: DARK },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 8,
  },
  weekday: {
    width: '14.285%',
    textAlign: 'center',
    paddingVertical: 8,
    fontWeight: '700',
    color: '#7186A3',
    fontSize: 11,
  },
  dayCell: {
    width: '14.285%',
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  otherMonth: { opacity: 0.35 },
  selectedDay: { backgroundColor: BLUE },
  dayText: { color: DARK, fontSize: 12 },
  selectedDayText: { color: '#fff', fontWeight: '800' },
  indicator: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: BLUE,
    position: 'absolute',
    bottom: 5,
  },
  selectedIndicator: { backgroundColor: '#fff' },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: { flex: 1, minHeight: 44 },
  filterLabel: {
    color: '#60748F',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  chip: {
    backgroundColor: '#EDF2F8',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginRight: 6,
  },
  chipActive: { backgroundColor: BLUE },
  chipText: { fontSize: 11, color: '#63758F' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginTop: 12,
  },
  progressPercent: { color: BLUE, fontSize: 19, fontWeight: '800' },
  progressTrack: {
    height: 9,
    borderRadius: 5,
    backgroundColor: '#E8EEF7',
    marginVertical: 9,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#36B981',
  },
  periodStats: {
    borderTopWidth: 1,
    borderColor: '#EDF1F6',
    marginTop: 10,
    paddingTop: 8,
    gap: 4,
  },
  fab: {
    position: 'absolute',
    bottom: 18,
    right: 16,
    backgroundColor: BLUE,
    borderRadius: 26,
    paddingHorizontal: 18,
    height: 52,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '800' },
  empty: { textAlign: 'center', color: '#7789A1', paddingVertical: 26 },
  error: {
    color: '#C43D48',
    backgroundColor: '#FFF0F0',
    padding: 10,
    borderRadius: 10,
    marginVertical: 6,
  },
});

const formStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7FAFE' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 15,
  },
  heading: { fontSize: 17, fontWeight: '800', color: DARK },
  link: { color: BLUE, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 36 },
  label: {
    color: '#60748F',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  field: { marginBottom: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#DFE7F2',
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: DARK,
    minHeight: 44,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 12,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 13,
  },
  typeButton: {
    borderWidth: 1,
    borderColor: '#DDE6F1',
    backgroundColor: '#fff',
    paddingVertical: 9,
    paddingHorizontal: 11,
    borderRadius: 12,
  },
  selectedType: { backgroundColor: '#EAF1FF', borderColor: BLUE },
  typeText: { fontSize: 12, color: '#677B95' },
  selectedTypeText: { color: BLUE, fontWeight: '800' },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#EDF2F8',
  },
  chipSelected: { backgroundColor: BLUE },
  chipText: { color: '#60748F', fontSize: 11 },
  chipTextSelected: { color: '#fff', fontWeight: '700' },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },
  save: {
    height: 48,
    backgroundColor: BLUE,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  saveText: { color: '#fff', fontWeight: '800' },
  error: { color: '#C43D48', marginVertical: 8 },
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateTimeButton: {
    flex: 1,
    minHeight: 46,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#DFE7F2',
    borderRadius: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dateTimeText: { flex: 1, color: DARK, fontSize: 13 },
  placeholderText: { color: '#8B9AB2' },
  clearDateButton: {
    width: 38,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(14,35,62,0.4)',
    justifyContent: 'center',
    padding: 18,
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
});

const detailStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(14,35,62,0.42)',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 17,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, color: DARK, fontSize: 19, fontWeight: '800' },
  subtitle: { color: BLUE, marginTop: 8, fontWeight: '700' },
  body: { color: '#566B85', marginTop: 8, lineHeight: 20 },
  label: { color: DARK, fontWeight: '800', marginTop: 17, marginBottom: 8 },
  reminder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#EEF1F6',
    marginVertical: 13,
    paddingVertical: 6,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#EAF1FF',
    padding: 12,
    borderRadius: 10,
  },
  danger: { backgroundColor: '#FFF0F0' },
  actionText: { color: BLUE, fontWeight: '800' },
});
