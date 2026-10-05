export const HEALTH_TASK_TYPES = ['medicine', 'doctor_appointment', 'health_checkup', 'health_schedule'];
export const HEALTH_TASK_STATUSES = ['pending', 'completed', 'skipped'];
export const RECURRENCE_TYPES = ['none', 'daily', 'weekly', 'monthly'];

export function dateKey(date) {
  const value = date instanceof Date ? date : new Date(`${date}T12:00:00`);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function dayOffset(date, amount) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return dateKey(value);
}

export function getOccurrenceDates({ startDate, endDate, repeatType = 'none', repeatDays = [], throughDate }) {
  if (!startDate) return [];
  const limit = endDate && endDate < throughDate ? endDate : throughDate;
  if (!limit || limit < startDate) return [];
  if (repeatType === 'none') return startDate <= limit ? [startDate] : [];
  const dates = [];
  for (let date = startDate; date <= limit; date = dayOffset(date, 1)) {
    const value = new Date(`${date}T12:00:00`);
    if (repeatType === 'daily' || (repeatType === 'weekly' && repeatDays.includes(value.getDay() || 7))) dates.push(date);
    if (repeatType === 'monthly' && value.getDate() === new Date(`${startDate}T12:00:00`).getDate()) dates.push(date);
  }
  return dates;
}

export function matchesTaskDate(taskDate, filter, today = dateKey(new Date())) {
  if (filter === 'all') return true;
  if (filter === 'today') return taskDate === today;
  if (filter === 'tomorrow') return taskDate === dayOffset(today, 1);
  const value = new Date(`${taskDate}T12:00:00`);
  const current = new Date(`${today}T12:00:00`);
  if (filter === 'week') {
    const monday = new Date(current);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const end = new Date(monday);
    end.setDate(end.getDate() + 6);
    return value >= monday && value <= end;
  }
  if (filter === 'month') return value.getFullYear() === current.getFullYear() && value.getMonth() === current.getMonth();
  return true;
}

export function summarizeTasks(tasks) {
  return tasks.reduce((summary, task) => {
    summary.total += 1;
    if (task.status === 'completed') summary.completed += 1;
    else if (task.status === 'skipped') summary.skipped += 1;
    else summary.pending += 1;
    if (task.task_type === 'medicine') summary.medicine += 1;
    if (task.task_type === 'doctor_appointment') summary.appointments += 1;
    if (task.task_type === 'health_checkup') summary.checkups += 1;
    return summary;
  }, { total: 0, pending: 0, completed: 0, skipped: 0, medicine: 0, appointments: 0, checkups: 0 });
}
