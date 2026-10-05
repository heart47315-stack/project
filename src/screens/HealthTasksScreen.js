import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { getLanguageText } from '../utils/i18n';
import { dateKey, getOccurrenceDates, matchesTaskDate, summarizeTasks } from '../utils/healthTaskUtils';
import { insertHealthTasks, listHealthTasks, removeHealthTask, updateHealthTask, extendRecurringTasks } from '../services/healthTaskService';

const BLUE = '#2F6FED';
const DARK = '#18365F';
const TYPES = ['medicine', 'doctor_appointment', 'health_checkup', 'health_schedule'];
const STATUSES = ['pending', 'completed', 'skipped'];
const REPEATS = ['none', 'daily', 'weekly', 'monthly'];
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const todayKey = () => dateKey(new Date());

async function scheduleMissingNotifications(rows, reminderBody) {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return { data: rows.map((row) => ({ ...row, notification_id: null })), error: null };
  const scheduled = [];
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const available = Math.max(0, 50 - existing.length);
    for (const [index, row] of rows.entries()) {
      if (index >= available) { scheduled.push({ ...row, notification_id: null }); continue; }
      const triggerDate = new Date(`${row.task_date}T${row.task_time || '09:00'}:00`);
      if (triggerDate <= new Date()) { scheduled.push({ ...row, notification_id: null }); continue; }
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: { title: row.title, body: row.description || reminderBody, channelId: 'reminders', data: { healthTaskId: row.id, seriesId: row.series_id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
      });
      scheduled.push({ ...row, notification_id: notificationId });
    }
    return { data: scheduled, error: null };
  } catch (scheduleError) {
    await Promise.all(scheduled.map((row) => row.notification_id ? Notifications.cancelScheduledNotificationAsync(row.notification_id) : Promise.resolve()));
    return { data: null, error: scheduleError };
  }
}

export default function HealthTasksScreen({ userId, language = 'th', onBack }) {
  const t = useCallback((key) => getLanguageText(language, `task_${key}`, getLanguageText(language, key)), [language]);
  const [tasks, setTasks] = useState([]);
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
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true); setError('');
    const first = await listHealthTasks(userId);
    if (first.error) { setError(first.error.message || t('loadFailed')); setTasks([]); setLoading(false); return; }
    const extension = await extendRecurringTasks(userId, first.data || [], (rows) => scheduleMissingNotifications(rows, t('task_taskReminderBody')));
    if (extension.error) setError(extension.error.message || t('loadFailed'));
    const latest = extension.data ? await listHealthTasks(userId) : first;
    if (latest.error) setError(latest.error.message || t('loadFailed'));
    else {
      const pendingReminders = (latest.data || []).filter((task) => task.enabled && task.status === 'pending' && !task.notification_id && `${task.task_date} ${task.task_time}` >= `${todayKey()} ${new Date().toTimeString().slice(0, 5)}`);
      const scheduled = await scheduleMissingNotifications(pendingReminders, t('task_taskReminderBody'));
      if (scheduled.data?.some((task) => task.notification_id)) {
        for (const task of scheduled.data.filter((row) => row.notification_id)) {
          const saved = await updateHealthTask(userId, task.id, { notification_id: task.notification_id });
          if (saved.error) await Notifications.cancelScheduledNotificationAsync(task.notification_id);
        }
        const refreshed = await listHealthTasks(userId);
        setTasks(refreshed.data || latest.data || []);
      } else setTasks(latest.data || []);
    }
    setLoading(false);
  }, [userId, t]);

  useEffect(() => { load(); }, [load]);


  const todayTasks = useMemo(() => tasks.filter((task) => task.task_date === todayKey()), [tasks]);
  const visibleTasks = useMemo(() => {
    let source = tab === 'history' ? tasks.filter((task) => task.status !== 'pending') : tasks;
    if (tab === 'today') source = source.filter((task) => task.task_date === todayKey());
    if (tab === 'calendar') source = source.filter((task) => task.task_date === selectedDate);
    if (tab === 'history') source = source.filter((task) => task.status === 'completed' || task.status === 'skipped');
    if (tab === 'all' || tab === 'history') {
      source = source.filter((task) => dateFilter === 'custom' ? task.task_date === customDate : matchesTaskDate(task.task_date, dateFilter));
      if (typeFilter !== 'all') source = source.filter((task) => task.task_type === typeFilter);
      if (statusFilter !== 'all') source = source.filter((task) => task.status === statusFilter);
      const term = search.trim().toLocaleLowerCase();
      if (term) source = source.filter((task) => [task.title, task.description, ...Object.values(task.metadata?.details || {})].filter(Boolean).join(' ').toLocaleLowerCase().includes(term));
    }
    return [...source].sort((a, b) => `${a.task_date} ${a.task_time || ''}`.localeCompare(`${b.task_date} ${b.task_time || ''}`));
  }, [tasks, tab, selectedDate, dateFilter, customDate, typeFilter, statusFilter, search]);

  const weekTasks = useMemo(() => tasks.filter((task) => matchesTaskDate(task.task_date, 'week')), [tasks]);
  const monthTasks = useMemo(() => tasks.filter((task) => matchesTaskDate(task.task_date, 'month')), [tasks]);
  const todaySummary = summarizeTasks(todayTasks);
  const weekSummary = summarizeTasks(weekTasks);
  const missedThisWeek = weekTasks.filter((task) => task.status === 'pending' && task.task_date < todayKey()).length;
  const monthSummary = summarizeTasks(monthTasks);
  const monthRate = monthSummary.total ? Math.round(100 * monthSummary.completed / monthSummary.total) : 0;

  const cancelTaskNotification = async (task) => {
    if (!task?.notification_id) return;
    await Notifications.cancelScheduledNotificationAsync(task.notification_id);
  };

  const setStatus = async (task, status) => {
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    if (status !== 'pending') await cancelTaskNotification(task);
    const result = await updateHealthTask(userId, task.id, { status, completed_at: completedAt, enabled: status === 'pending' ? task.enabled : false, notification_id: status === 'pending' ? task.notification_id : null });
    if (result.error) { setError(result.error.message || t('saveFailed')); return; }
    setDetail(result.data); await load();
  };

  const removeTask = async (task) => {
    await cancelTaskNotification(task);
    const result = await removeHealthTask(userId, task.id);
    if (result.error) setError(result.error.message || t('deleteFailed'));
    else { setDetail(null); await load(); }
  };

  const changeReminder = async (task, enabled) => {
    if (!enabled) {
      await cancelTaskNotification(task);
      const result = await updateHealthTask(userId, task.id, { enabled: false, notification_id: null });
      if (result.error) setError(result.error.message || t('saveFailed')); else { setDetail(result.data); await load(); }
      return;
    }
    const permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) { setError(t('notificationPermission')); return; }
    const triggerDate = new Date(`${task.task_date}T${task.task_time || '09:00'}:00`);
    const pendingCount = await Notifications.getAllScheduledNotificationsAsync();
    if (pendingCount.length >= 50) { setError(t('notificationCapacity')); return; }
    const notificationId = await Notifications.scheduleNotificationAsync({ content: { title: task.title, body: task.description || t('taskReminderBody'), channelId: 'reminders', data: { healthTaskId: task.id } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate } });
    const result = await updateHealthTask(userId, task.id, { enabled: true, notification_id: notificationId });
    if (result.error) { await Notifications.cancelScheduledNotificationAsync(notificationId); setError(result.error.message || t('saveFailed')); }
    else { setDetail(result.data); await load(); }
  };

  const saveTask = async (draft) => {
    setError('');
    if (!draft.title.trim()) { setError(t('titleRequired')); return false; }
    const parsedDate = new Date(`${draft.task_date}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.task_date) || !Number.isFinite(parsedDate.getTime()) || dateKey(parsedDate) !== draft.task_date) { setError(t('invalidDate')); return false; }
    if (draft.end_date) {
      const parsedEndDate = new Date(`${draft.end_date}T12:00:00`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.end_date) || !Number.isFinite(parsedEndDate.getTime()) || dateKey(parsedEndDate) !== draft.end_date || draft.end_date < draft.task_date) { setError(t('invalidEndDate')); return false; }
    }
    if (draft.task_time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.task_time)) { setError(t('invalidTime')); return false; }
    if (draft.task_type === 'medicine' && !draft.task_time) { setError(t('medicineTimeRequired')); return false; }
    if (draft.repeat_type === 'weekly' && !draft.repeat_days.length) { setError(t('selectWeekday')); return false; }
    const details = Object.fromEntries(Object.entries(draft.details).filter(([, value]) => value.trim()));
    const description = draft.description.trim() || null;
    if (editing) {
      let notificationId = null;
      if (draft.reminder) {
        const permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted) { setError(t('notificationPermission')); return false; }
        const pending = await Notifications.getAllScheduledNotificationsAsync();
        if (!editing.notification_id && pending.length >= 50) { setError(t('notificationCapacity')); return false; }
      }
      await cancelTaskNotification(editing);
      if (draft.reminder) {
        const result = await scheduleMissingNotifications([{ ...editing, title: draft.title.trim(), description, task_date: draft.task_date, task_time: draft.task_time || '09:00', metadata: { ...editing.metadata, details } }], t('task_taskReminderBody'));
        if (result.error) { setError(result.error.message || t('saveFailed')); return false; }
        notificationId = result.data[0].notification_id;
        if (!notificationId) { setError(t('notificationCapacity')); return false; }
      }
      const updated = await updateHealthTask(userId, editing.id, { title: draft.title.trim(), description, task_type: draft.task_type, task_date: draft.task_date, task_time: draft.task_time || '09:00', repeat_type: draft.repeat_type, repeat_days: draft.repeat_days, metadata: { ...editing.metadata, details }, enabled: draft.reminder, notification_id: notificationId });
      if (updated.error) { if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId); setError(updated.error.message || t('saveFailed')); return false; }
      setEditing(null); setFormVisible(false); setDetail(updated.data); await load(); return true;
    }
    const start = draft.task_date;
    let through = dateKey(new Date(Date.now() + 90 * 86400000));
    if (draft.end_date && draft.end_date < through) through = draft.end_date;
    if (draft.repeat_type === 'none') through = start;
    const dates = getOccurrenceDates({ startDate: draft.repeat_type === 'none' || start >= todayKey() ? start : todayKey(), endDate: draft.end_date || null, repeatType: draft.repeat_type, repeatDays: draft.repeat_days, throughDate: through });
    if (!dates.length) { setError(t('noTaskDates')); return false; }
    const seriesId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => { const random = Math.floor(Math.random() * 16); return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16); });
    const metadata = { details, series_start_date: start, series_end_date: draft.end_date || null, series_generation_until: through };
    const rows = dates.map((taskDate) => ({ series_id: seriesId, title: draft.title.trim(), description, task_type: draft.task_type, status: 'pending', task_date: taskDate, task_time: draft.task_time || null, repeat_type: draft.repeat_type, repeat_days: draft.repeat_days, enabled: draft.reminder, completed_at: null, notification_id: null, metadata }));
    let scheduled = rows;
    if (draft.reminder) {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) { setError(t('notificationPermission')); return false; }
      const result = await scheduleMissingNotifications(rows, t('task_taskReminderBody'));
      if (result.error) { setError(result.error.message || t('saveFailed')); return false; }
      scheduled = result.data;
    }
    const result = await insertHealthTasks(userId, scheduled);
    if (result.error) {
      await Promise.all(scheduled.map((task) => task.notification_id ? Notifications.cancelScheduledNotificationAsync(task.notification_id) : Promise.resolve()));
      setError(result.error.message || t('saveFailed')); return false;
    }
    setFormVisible(false); setError(scheduled.some((task) => !task.notification_id) && draft.reminder ? t('notificationCapacity') : ''); await load(); return true;
  };

  const startEdit = (task) => {
    setEditing(task); setDetail(null); setFormVisible(true);
  };

  const tabButtons = ['today', 'calendar', 'all', 'history'];
  const typeLabels = { medicine: 'medicine', doctor_appointment: 'appointment', health_checkup: 'checkup', health_schedule: 'schedule' };
  const statusLabel = { pending: 'pending', completed: 'completed', skipped: 'skipped' };
  const typeIcon = { medicine: 'pill', doctor_appointment: 'hospital-building', health_checkup: 'stethoscope', health_schedule: 'calendar-check' };

  const changeMonth = (amount) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1));
  const monthGrid = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return { date: dateKey(day), inMonth: day.getMonth() === month.getMonth() }; });
  }, [month]);
  const countsByDate = useMemo(() => tasks.reduce((acc, task) => { acc[task.task_date] = (acc[task.task_date] || 0) + 1; return acc; }, {}), [tasks]);

  return <SafeAreaView style={styles.screen}>
    <View style={styles.header}><Pressable onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={22} color={DARK} /></Pressable><Text style={styles.headerTitle}>{t('healthTasks')}</Text><Pressable onPress={() => { setEditing(null); setFormVisible(true); }} style={styles.addIcon}><Ionicons name="add" size={26} color="#fff" /></Pressable></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.tabs}>{tabButtons.map((name) => <Pressable key={name} onPress={() => setTab(name)} style={[styles.tab, tab === name && styles.activeTab]}><Text style={[styles.tabText, tab === name && styles.activeTabText]}>{t(name)}</Text></Pressable>)}</View>
      {tab === 'today' ? <>
        <View style={styles.todayCard}><Text style={styles.todayHeading}>{t('today')}</Text><Text style={styles.dateText}>{new Date(`${todayKey()}T12:00:00`).toLocaleDateString(language === 'en' ? 'en-US' : 'th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</Text>
          <View style={styles.metrics}>{[['total', todaySummary.total], ['pending', todaySummary.pending], ['completed', todaySummary.completed], ['skipped', todaySummary.skipped]].map(([key, value]) => <View style={styles.metric} key={key}><Text style={styles.metricNumber}>{value}</Text><Text style={styles.metricLabel}>{t(key)}</Text></View>)}</View>
        </View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{t('todayTasks')}</Text><Text style={styles.count}>{todayTasks.length}</Text></View>
      </> : null}
      {tab === 'calendar' ? <>
        <View style={styles.monthHeader}><Pressable onPress={() => changeMonth(-1)}><Ionicons name="chevron-back" color={BLUE} size={22} /></Pressable><Text style={styles.monthTitle}>{month.toLocaleDateString(language === 'en' ? 'en-US' : 'th-TH', { month: 'long', year: 'numeric' })}</Text><Pressable onPress={() => changeMonth(1)}><Ionicons name="chevron-forward" color={BLUE} size={22} /></Pressable></View>
        <View style={styles.calendarGrid}>{WEEKDAYS.map((day) => <Text key={day} style={styles.weekday}>{t(day).slice(0, 2)}</Text>)}{monthGrid.map(({ date, inMonth }) => <Pressable key={date} onPress={() => setSelectedDate(date)} style={[styles.dayCell, !inMonth && styles.otherMonth, selectedDate === date && styles.selectedDay]}><Text style={[styles.dayText, selectedDate === date && styles.selectedDayText]}>{Number(date.slice(-2))}</Text>{countsByDate[date] ? <View style={[styles.indicator, selectedDate === date && styles.selectedIndicator]} /> : null}</Pressable>)}</View>
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{selectedDate}</Text><Text style={styles.count}>{visibleTasks.length}</Text></View>
      </> : null}
      {tab === 'all' || tab === 'history' ? <>
        <View style={styles.search}><Ionicons name="search" size={18} color="#8B9AB2" /><TextInput value={search} onChangeText={setSearch} placeholder={t('search')} style={styles.searchInput} /></View>
        <Text style={styles.filterLabel}>{t('typeFilter')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{['all', ...TYPES].map((value) => <Pressable key={value} onPress={() => setTypeFilter(value)} style={[styles.chip, typeFilter === value && styles.chipActive]}><Text style={[styles.chipText, typeFilter === value && styles.chipTextActive]}>{t(value === 'all' ? 'all' : typeLabels[value])}</Text></Pressable>)}</ScrollView>
        <Text style={styles.filterLabel}>{t('statusFilter')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{['all', ...STATUSES].map((value) => <Pressable key={value} onPress={() => setStatusFilter(value)} style={[styles.chip, statusFilter === value && styles.chipActive]}><Text style={[styles.chipText, statusFilter === value && styles.chipTextActive]}>{t(value)}</Text></Pressable>)}</ScrollView>
        <Text style={styles.filterLabel}>{t('dateFilter')}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{['all', 'today', 'tomorrow', 'week', 'month', 'custom'].map((value) => <Pressable key={value} onPress={() => setDateFilter(value)} style={[styles.chip, dateFilter === value && styles.chipActive]}><Text style={[styles.chipText, dateFilter === value && styles.chipTextActive]}>{t(value)}</Text></Pressable>)}</ScrollView>{dateFilter === 'custom' ? <Field label={t('customDate')} value={customDate} onChangeText={setCustomDate} placeholder="YYYY-MM-DD" /> : null}
        <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{t(tab)}</Text><Text style={styles.count}>{visibleTasks.length}</Text></View>
      </> : null}
      {tab === 'today' || tab === 'calendar' ? <View style={{ marginTop: 4 }} /> : null}
      {loading ? <ActivityIndicator color={BLUE} style={{ marginTop: 28 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading && visibleTasks.length === 0 ? <Text style={styles.empty}>{t('noTasks')}</Text> : null}
      {!loading ? visibleTasks.map((task) => <Pressable key={task.id} style={styles.taskCard} onPress={() => setDetail(task)}>
        <View style={styles.taskIcon}><MaterialCommunityIcons name={typeIcon[task.task_type]} size={24} color={BLUE} /></View><View style={{ flex: 1 }}><Text style={styles.taskType}>{t(typeLabels[task.task_type])}</Text><Text style={styles.taskTitle}>{task.title}</Text><Text style={styles.taskSub}>{task.task_time ? task.task_time.slice(0, 5) : t('noTime')}{task.description ? ` · ${task.description}` : ''}</Text>{task.notification_id ? <Text style={styles.reminder}><Ionicons name="notifications-outline" size={14} color={BLUE} /> {t('reminderOn')}</Text> : null}</View>
        <Pressable onPress={(event) => { event.stopPropagation(); setStatus(task, task.status === 'pending' ? 'completed' : task.status === 'completed' ? 'skipped' : 'pending'); }} style={[styles.badge, styles[`badge_${task.status}`]]}><Text style={styles.badgeText}>{t(statusLabel[task.status])}</Text></Pressable>
      </Pressable>) : null}
      <View style={styles.progressCard}><View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{t('healthProgress')}</Text><Text style={styles.progressPercent}>{monthRate}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${monthRate}%` }]} /></View><Text style={styles.taskSub}>{t('monthlyProgress').replace('{done}', String(monthSummary.completed)).replace('{total}', String(monthSummary.total))}</Text><View style={styles.periodStats}><Text style={styles.taskSub}>{t('weekSummary').replace('{total}', String(weekSummary.total)).replace('{done}', String(weekSummary.completed)).replace('{missed}', String(missedThisWeek))}</Text><Text style={styles.taskSub}>{t('monthTypes').replace('{medicine}', String(monthSummary.medicine)).replace('{appointments}', String(monthSummary.appointments)).replace('{checkups}', String(monthSummary.checkups))}</Text></View></View>
      <Pressable style={styles.fab} onPress={() => { setEditing(null); setFormVisible(true); }}><Ionicons name="add" size={24} color="#fff" /><Text style={styles.fabText}>{t('addTask')}</Text></Pressable>
    </ScrollView>
    <TaskForm visible={formVisible} initial={editing} language={language} errorMessage={error} onClose={() => { setFormVisible(false); setEditing(null); setError(''); }} onSave={saveTask} />
    <TaskDetail task={detail} language={language} errorMessage={error} onClose={() => setDetail(null)} onStatus={setStatus} onEdit={startEdit} onDelete={removeTask} onReminder={changeReminder} />
  </SafeAreaView>;

}

function TaskForm({ visible, initial, language, onClose, onSave, errorMessage }) {
  const t = (key) => getLanguageText(language, `task_${key}`, getLanguageText(language, key));
  const [draft, setDraft] = useState(blankDraft());
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (visible) setDraft(initial ? { task_type: initial.task_type, title: initial.title, task_date: initial.task_date, task_time: initial.task_time?.slice(0, 5) || '', repeat_type: initial.repeat_type, repeat_days: initial.repeat_days || [], end_date: initial.metadata?.series_end_date || '', description: initial.description || '', details: initial.metadata?.details || {}, reminder: Boolean(initial.enabled) } : blankDraft());
  }, [visible, initial]);
  const update = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const updateDetail = (key, value) => setDraft((current) => ({ ...current, details: { ...current.details, [key]: value } }));
  const toggleWeekday = (day) => { const dayNumber = WEEKDAYS.indexOf(day) + 1; update('repeat_days', draft.repeat_days.includes(dayNumber) ? draft.repeat_days.filter((value) => value !== dayNumber) : [...draft.repeat_days, dayNumber].sort()); };
  const submit = async () => { setSaving(true); try { const ok = await onSave(draft); if (ok) setDraft(blankDraft()); } finally { setSaving(false); } };
  const extraFields = draft.task_type === 'medicine' ? [['dosage', 'dosage'], ['notes', 'notes']] : draft.task_type === 'doctor_appointment' ? [['hospital', 'hospital'], ['doctor', 'doctor'], ['location', 'location'], ['details', 'details'], ['notes', 'notes']] : draft.task_type === 'health_checkup' ? [['checkupName', 'checkup'], ['location', 'location'], ['details', 'details'], ['notes', 'notes']] : [['details', 'details'], ['notes', 'notes']];
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={formStyles.safe}><View style={formStyles.header}><Pressable onPress={onClose}><Text style={formStyles.link}>{t('cancel')}</Text></Pressable><Text style={formStyles.heading}>{initial ? t('editTask') : t('addTask')}</Text><View style={{ width: 40 }} /></View><ScrollView contentContainerStyle={formStyles.content} keyboardShouldPersistTaps="handled">
    <Text style={formStyles.label}>{t('typeFilter')}</Text><View style={formStyles.typeGrid}>{TYPES.map((type) => <Pressable key={type} onPress={() => update('task_type', type)} style={[formStyles.typeButton, draft.task_type === type && formStyles.selectedType]}><Text style={[formStyles.typeText, draft.task_type === type && formStyles.selectedTypeText]}>{t(type)}</Text></Pressable>)}</View>
    <Field label={t('title')} value={draft.title} onChangeText={(value) => update('title', value)} />
    {extraFields.map(([key, placeholder]) => <Field key={key} label={t(key)} value={draft.details[key] || ''} onChangeText={(value) => updateDetail(key, value)} />)}
    <Field label={t('description')} value={draft.description} onChangeText={(value) => update('description', value)} multiline />
    <View style={formStyles.row}><View style={{ flex: 1 }}><Field label={t('date')} value={draft.task_date} onChangeText={(value) => update('task_date', value)} placeholder="YYYY-MM-DD" /></View><View style={{ flex: 1 }}><Field label={t('time')} value={draft.task_time} onChangeText={(value) => update('task_time', value)} placeholder="HH:mm" /></View></View>
    <Field label={t('endDate')} value={draft.end_date} onChangeText={(value) => update('end_date', value)} placeholder="YYYY-MM-DD" />
    <Text style={formStyles.label}>{t('repeat')}</Text><View style={formStyles.row}>{REPEATS.map((repeat) => <Pressable key={repeat} onPress={() => update('repeat_type', repeat)} style={[formStyles.chip, draft.repeat_type === repeat && formStyles.chipSelected]}><Text style={[formStyles.chipText, draft.repeat_type === repeat && formStyles.chipTextSelected]}>{t(repeat)}</Text></Pressable>)}</View>
    {draft.repeat_type === 'weekly' ? <View style={formStyles.rowWrap}>{WEEKDAYS.map((day) => <Pressable key={day} onPress={() => toggleWeekday(day)} style={[formStyles.chip, draft.repeat_days.includes(WEEKDAYS.indexOf(day) + 1) && formStyles.chipSelected]}><Text style={[formStyles.chipText, draft.repeat_days.includes(WEEKDAYS.indexOf(day) + 1) && formStyles.chipTextSelected]}>{t(day)}</Text></Pressable>)}</View> : null}
    <View style={formStyles.reminderRow}><Text style={formStyles.label}>{t('setReminder')}</Text><Switch value={draft.reminder} onValueChange={(value) => update('reminder', value)} trackColor={{ true: '#A9C4FA' }} thumbColor={BLUE} /></View>
    {errorMessage ? <Text style={formStyles.error}>{errorMessage}</Text> : null}<Pressable onPress={submit} disabled={saving} style={formStyles.save}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={formStyles.saveText}>{initial ? t('save') : t('addTask')}</Text>}</Pressable>
  </ScrollView></SafeAreaView></Modal>;
}

function blankDraft() { return { task_type: 'medicine', title: '', task_date: todayKey(), task_time: '09:00', repeat_type: 'none', repeat_days: [], end_date: '', description: '', details: {}, reminder: true }; }

function Field({ label, value, onChangeText, placeholder, multiline }) { return <View style={formStyles.field}><Text style={formStyles.label}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} multiline={multiline} style={[formStyles.input, multiline && { minHeight: 76, textAlignVertical: 'top' }]} /></View>; }

function TaskDetail({ task, language, errorMessage, onClose, onStatus, onEdit, onDelete, onReminder }) {
  const t = (key) => getLanguageText(language, `task_${key}`, getLanguageText(language, key));
  return <Modal visible={Boolean(task)} transparent animationType="fade" onRequestClose={onClose}><View style={detailStyles.overlay}><View style={detailStyles.card}><View style={detailStyles.top}><Text style={detailStyles.title}>{task?.title}</Text><Pressable onPress={onClose}><Ionicons name="close" size={24} color="#788BA5" /></Pressable></View>{task ? <ScrollView>
    <Text style={detailStyles.subtitle}>{t(task.task_type)} · {task.task_date} {task.task_time?.slice(0, 5) || ''}</Text><Text style={detailStyles.body}>{task.description}</Text>{Object.entries(task.metadata?.details || {}).map(([key, value]) => <Text key={key} style={detailStyles.body}>{t(key)}: {value}</Text>)}
    <Text style={detailStyles.label}>{t('statusFilter')}</Text><View style={formStyles.row}>{STATUSES.map((status) => <Pressable key={status} onPress={() => onStatus(task, status)} style={[formStyles.chip, task.status === status && formStyles.chipSelected]}><Text style={[formStyles.chipText, task.status === status && formStyles.chipTextSelected]}>{t(status)}</Text></Pressable>)}</View>
    <View style={detailStyles.reminder}><Text style={detailStyles.body}>{t('setReminder')}</Text><Switch value={Boolean(task.enabled)} onValueChange={(value) => onReminder(task, value)} trackColor={{ true: '#A9C4FA' }} thumbColor={BLUE} /></View>
    {errorMessage ? <Text style={formStyles.error}>{errorMessage}</Text> : null}<View style={formStyles.row}><Pressable onPress={() => onEdit(task)} style={detailStyles.action}><Text style={detailStyles.actionText}>{t('editTask')}</Text></Pressable><Pressable onPress={() => Alert.alert(t('deleteTask'), t('deleteConfirm'), [{ text: t('cancel'), style: 'cancel' }, { text: t('deleteTask'), style: 'destructive', onPress: () => onDelete(task) }])} style={[detailStyles.action, detailStyles.danger]}><Text style={detailStyles.actionText}>{t('deleteTask')}</Text></Pressable></View>
  </ScrollView> : null}</View></View></Modal>;
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#F5F8FC' }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff' }, back: { width: 36 }, headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: DARK }, addIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' }, content: { padding: 16, paddingBottom: 96 }, tabs: { flexDirection: 'row', backgroundColor: '#E9EFF8', borderRadius: 12, padding: 4, marginBottom: 14 }, tab: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' }, activeTab: { backgroundColor: '#fff', elevation: 1 }, tabText: { fontSize: 12, color: '#70829B', fontWeight: '600' }, activeTabText: { color: BLUE }, todayCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 18 }, todayHeading: { color: DARK, fontSize: 24, fontWeight: '800' }, dateText: { color: '#7386A0', marginTop: 3 }, metrics: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 }, metric: { alignItems: 'center', minWidth: 62 }, metricNumber: { fontSize: 22, fontWeight: '800', color: DARK }, metricLabel: { fontSize: 11, color: '#72849D' }, sectionHeading: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 10 }, sectionTitle: { flex: 1, color: DARK, fontSize: 17, fontWeight: '800' }, count: { color: BLUE, fontWeight: '700' }, taskCard: { backgroundColor: '#fff', borderRadius: 15, padding: 13, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 11 }, taskIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#EAF1FF', alignItems: 'center', justifyContent: 'center' }, taskType: { color: BLUE, fontSize: 11, fontWeight: '700' }, taskTitle: { color: DARK, fontSize: 15, fontWeight: '700', marginTop: 2 }, taskSub: { color: '#7B8CA4', fontSize: 12, marginTop: 4 }, reminder: { color: BLUE, fontSize: 11, marginTop: 5 }, badge: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10 }, badge_pending: { backgroundColor: '#FFF2D9' }, badge_completed: { backgroundColor: '#E1F7EC' }, badge_skipped: { backgroundColor: '#EEF0F4' }, badgeText: { color: DARK, fontSize: 10, fontWeight: '700' }, monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10 }, monthTitle: { fontSize: 16, fontWeight: '800', color: DARK }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#fff', borderRadius: 14, padding: 8 }, weekday: { width: '14.285%', textAlign: 'center', paddingVertical: 8, fontWeight: '700', color: '#7186A3', fontSize: 11 }, dayCell: { width: '14.285%', height: 43, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, otherMonth: { opacity: 0.35 }, selectedDay: { backgroundColor: BLUE }, dayText: { color: DARK, fontSize: 12 }, selectedDayText: { color: '#fff', fontWeight: '800' }, indicator: { width: 4, height: 4, borderRadius: 2, backgroundColor: BLUE, position: 'absolute', bottom: 5 }, selectedIndicator: { backgroundColor: '#fff' }, search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, marginBottom: 10 }, searchInput: { flex: 1, minHeight: 44 }, filterLabel: { color: '#60748F', fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 6 }, chip: { backgroundColor: '#EDF2F8', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7, marginRight: 6 }, chipActive: { backgroundColor: BLUE }, chipText: { fontSize: 11, color: '#63758F' }, chipTextActive: { color: '#fff', fontWeight: '700' }, progressCard: { backgroundColor: '#fff', borderRadius: 15, padding: 15, marginTop: 12 }, progressPercent: { color: BLUE, fontSize: 19, fontWeight: '800' }, progressTrack: { height: 9, borderRadius: 5, backgroundColor: '#E8EEF7', marginVertical: 9, overflow: 'hidden' }, progressFill: { height: '100%', borderRadius: 5, backgroundColor: '#36B981' }, periodStats: { borderTopWidth: 1, borderColor: '#EDF1F6', marginTop: 10, paddingTop: 8, gap: 4 }, fab: { position: 'absolute', bottom: 18, right: 16, backgroundColor: BLUE, borderRadius: 26, paddingHorizontal: 18, height: 52, alignItems: 'center', flexDirection: 'row', gap: 6, elevation: 4 }, fabText: { color: '#fff', fontWeight: '800' }, empty: { textAlign: 'center', color: '#7789A1', paddingVertical: 26 }, error: { color: '#C43D48', backgroundColor: '#FFF0F0', padding: 10, borderRadius: 10, marginVertical: 6 } });
const formStyles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#F7FAFE' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 15 }, heading: { fontSize: 17, fontWeight: '800', color: DARK }, link: { color: BLUE, fontWeight: '700' }, content: { padding: 16, paddingBottom: 36 }, label: { color: '#60748F', fontSize: 12, fontWeight: '700', marginBottom: 6 }, field: { marginBottom: 12 }, input: { backgroundColor: '#fff', borderRadius: 11, borderWidth: 1, borderColor: '#DFE7F2', paddingHorizontal: 12, paddingVertical: 11, color: DARK, minHeight: 44 }, row: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }, rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }, typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 13 }, typeButton: { borderWidth: 1, borderColor: '#DDE6F1', backgroundColor: '#fff', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 12 }, selectedType: { backgroundColor: '#EAF1FF', borderColor: BLUE }, typeText: { fontSize: 12, color: '#677B95' }, selectedTypeText: { color: BLUE, fontWeight: '800' }, chip: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#EDF2F8' }, chipSelected: { backgroundColor: BLUE }, chipText: { color: '#60748F', fontSize: 11 }, chipTextSelected: { color: '#fff', fontWeight: '700' }, reminderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7 }, save: { height: 48, backgroundColor: BLUE, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, saveText: { color: '#fff', fontWeight: '800' }, error: { color: '#C43D48', marginVertical: 8 } });
const detailStyles = StyleSheet.create({ overlay: { flex: 1, backgroundColor: 'rgba(14,35,62,0.42)', justifyContent: 'center', padding: 18 }, card: { maxHeight: '85%', backgroundColor: '#fff', borderRadius: 18, padding: 17 }, top: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { flex: 1, color: DARK, fontSize: 19, fontWeight: '800' }, subtitle: { color: BLUE, marginTop: 8, fontWeight: '700' }, body: { color: '#566B85', marginTop: 8, lineHeight: 20 }, label: { color: DARK, fontWeight: '800', marginTop: 17, marginBottom: 8 }, reminder: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#EEF1F6', marginVertical: 13, paddingVertical: 6 }, action: { flex: 1, alignItems: 'center', backgroundColor: '#EAF1FF', padding: 12, borderRadius: 10 }, danger: { backgroundColor: '#FFF0F0' }, actionText: { color: BLUE, fontWeight: '800' } });
