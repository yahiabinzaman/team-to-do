//  100% Native Apple Desktop Widget Engine (Cupertino HIG)

const State = {
  version: 1,
  employees: [],
  tasks: [],
  clients: [],
  schedules: [],
  displayMode: 'tasks', // 'tasks', 'team', 'timeline'
  filterEmployeeId: null,
  socket: null,
  peerCount: 1,
  isConnected: false
};

// WebSocket Real-time Sync
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  try {
    State.socket = new WebSocket(wsUrl);

    State.socket.onopen = () => {
      State.isConnected = true;
      updateSyncUI('connected');
    };

    State.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {}
    };

    State.socket.onclose = () => {
      State.isConnected = false;
      updateSyncUI('disconnected');
      setTimeout(initWebSocket, 2000);
    };
  } catch (e) {
    setTimeout(initWebSocket, 2500);
  }
}

function sendAction(type, payload) {
  if (State.socket && State.socket.readyState === WebSocket.OPEN) {
    State.socket.send(JSON.stringify({ type, payload, actionId: 'act-' + Date.now() }));
  }
}

function handleServerMessage(msg) {
  const { type, data, task, employee, schedule, id, count } = msg;

  if (type === 'INITIAL_STATE' || type === 'FULL_SYNC') {
    if (data) {
      State.employees = data.employees || [];
      State.tasks = data.tasks || [];
      State.clients = data.clients || [];
      State.schedules = data.schedules || [];
      renderWidget();
    }
  } else if (type === 'PEER_COUNT_UPDATE') {
    State.peerCount = count || 1;
    updateSyncUI(State.isConnected ? 'connected' : 'disconnected');
  } else {
    if (type === 'TASK_ADDED' && task) {
      const exists = State.tasks.some(t => t.id === task.id);
      if (!exists) {
        State.tasks.unshift(task);
        if (window.appleSounds) window.appleSounds.playPop();
      }
    }
    if (type === 'TASK_UPDATED' && task) {
      const idx = State.tasks.findIndex(t => t.id === task.id);
      if (idx !== -1) {
        State.tasks[idx] = task;
      } else {
        State.tasks.unshift(task);
      }
    }
    if (type === 'TASK_DELETED') {
      State.tasks = State.tasks.filter(t => t.id !== id);
    }
    if (type === 'EMPLOYEE_ADDED' && employee) {
      const exists = State.employees.some(e => e.id === employee.id);
      if (!exists) State.employees.push(employee);
    }
    if (type === 'EMPLOYEE_UPDATED' && employee) {
      const idx = State.employees.findIndex(e => e.id === employee.id);
      if (idx !== -1) State.employees[idx] = employee;
    }
    if (type === 'EMPLOYEE_DELETED') {
      State.employees = State.employees.filter(e => e.id !== id);
    }
    renderWidget();
  }
}

function updateSyncUI(status) {
  const badge = document.getElementById('syncPeerCountBadge');
  if (badge) {
    badge.textContent = status === 'connected' 
      ? (State.peerCount > 1 ? `● ${State.peerCount} Devices Synced` : '● Live Synced')
      : '○ Offline';
  }
}

function setWidgetDisplayMode(mode) {
  State.displayMode = mode;
  document.getElementById('btnModeTasks')?.classList.toggle('active', mode === 'tasks');
  document.getElementById('btnModeTeam')?.classList.toggle('active', mode === 'team');
  document.getElementById('btnModeTimeline')?.classList.toggle('active', mode === 'timeline');
  document.getElementById('btnModeHistory')?.classList.toggle('active', mode === 'history');

  document.getElementById('tasksView')?.classList.toggle('active', mode === 'tasks');
  document.getElementById('teamView')?.classList.toggle('active', mode === 'team');
  document.getElementById('timelineView')?.classList.toggle('active', mode === 'timeline');
  document.getElementById('historyView')?.classList.toggle('active', mode === 'history');

  renderWidget();
}

function renderWidget() {
  const pendingTasks = State.tasks.filter(t => !t.completed);
  const completedTasks = State.tasks.filter(t => t.completed);
  
  // Header Count
  const countEl = document.getElementById('widgetMainCount');
  const labelEl = document.getElementById('widgetMainLabel');
  if (countEl) countEl.textContent = pendingTasks.length;
  if (labelEl) {
    labelEl.innerHTML = `<span>Reminders</span> • <span style="color:var(--text-tertiary);">${completedTasks.length} Done</span>`;
  }

  // Render Tab Views
  if (State.displayMode === 'tasks') renderTasksView();
  if (State.displayMode === 'team') renderTeamView();
  if (State.displayMode === 'timeline') renderTimelineView();
  if (State.displayMode === 'history') renderHistoryView();

  renderSettingsData();
  renderDropdowns();
}

// 1. All Active Tasks View Grouped by Date (Today, Tomorrow, Later Dates, No Date)
function renderTasksView() {
  const container = document.getElementById('tasksListContainer');
  const banner = document.getElementById('activeMemberFilterBanner');
  const bannerText = document.getElementById('activeMemberFilterText');
  if (!container) return;

  let allMemberTasks = State.tasks;
  if (State.filterEmployeeId) {
    const filterEmp = State.employees.find(e => e.id === State.filterEmployeeId);
    allMemberTasks = State.tasks.filter(t => t.employeeId === State.filterEmployeeId);
    if (banner && bannerText && filterEmp) {
      banner.style.display = 'flex';
      bannerText.textContent = `${filterEmp.name}'s Tasks`;
    }
  } else {
    if (banner) banner.style.display = 'none';
  }

  const activeTasks = allMemberTasks.filter(t => !t.completed);
  const completedTasks = allMemberTasks.filter(t => t.completed);

  if (activeTasks.length === 0) {
    let emptyHtml = `
      <div style="text-align:center; padding:35px 20px 20px; font-size:12px; color:var(--text-tertiary);">
        <div style="font-size: 20px; margin-bottom: 6px;">✓</div>
        All Tasks Completed!
      </div>
    `;
    if (completedTasks.length > 0) {
      emptyHtml += `
        <div class="tasks-completed-footer" onclick="setWidgetDisplayMode('history')">
          ✓ ${completedTasks.length} Completed in History →
        </div>
      `;
    }
    container.innerHTML = emptyHtml;
    return;
  }

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const groups = {
    overdue: [],
    today: [],
    tomorrow: [],
    upcoming: {},
    noDate: []
  };

  activeTasks.forEach(task => {
    const d = task.dueDate;
    if (!d) {
      groups.noDate.push(task);
    } else if (d < todayStr) {
      groups.overdue.push(task);
    } else if (d === todayStr) {
      groups.today.push(task);
    } else if (d === tomorrowStr) {
      groups.tomorrow.push(task);
    } else {
      if (!groups.upcoming[d]) groups.upcoming[d] = [];
      groups.upcoming[d].push(task);
    }
  });

  let html = '';

  function renderTaskRow(task) {
    const emp = State.employees.find(e => e.id === task.employeeId);
    const empName = emp ? emp.name : 'Unassigned';
    const empColor = emp ? (emp.avatarColor || '#0A84FF') : '#0A84FF';

    let timeText = '';
    if (task.dueTime) {
      const parts = task.dueTime.split(':');
      let h = parseInt(parts[0], 10);
      const m = parts[1] || '00';
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      timeText = `${h}:${m} ${ampm}`;
    }

    return `
      <div class="reminder-item-row" id="item-${task.id}">
        <input 
          type="checkbox" 
          class="apple-checkbox" 
          onchange="toggleTaskDone('${task.id}')"
        >
        <div class="reminder-content" onclick="openEditTaskModal('${task.id}')">
          <div class="reminder-title">${escapeHtml(task.title)}</div>
          <div class="reminder-meta-text">
            <span class="task-assignee-highlight" style="--emp-color:${empColor}">
              <span class="task-assignee-dot" style="background:${empColor};"></span>
              ${escapeHtml(empName)}
            </span>
            ${task.client ? `<span class="task-client-badge">${escapeHtml(task.client)}</span>` : ''}
            ${timeText ? `<span class="task-time-meta">${timeText}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // 1. Overdue Section
  if (groups.overdue.length > 0) {
    html += `
      <div class="task-section-group">
        <div class="task-section-header overdue">Overdue (${groups.overdue.length})</div>
        ${groups.overdue.map(renderTaskRow).join('')}
      </div>
    `;
  }

  // 2. Today Section
  if (groups.today.length > 0) {
    html += `
      <div class="task-section-group">
        <div class="task-section-header today">Today (${groups.today.length})</div>
        ${groups.today.map(renderTaskRow).join('')}
      </div>
    `;
  }

  // 3. Tomorrow Section
  if (groups.tomorrow.length > 0) {
    html += `
      <div class="task-section-group">
        <div class="task-section-header">Tomorrow (${groups.tomorrow.length})</div>
        ${groups.tomorrow.map(renderTaskRow).join('')}
      </div>
    `;
  }

  // 4. Upcoming Specific Dates sorted chronologically
  const sortedDates = Object.keys(groups.upcoming).sort();
  sortedDates.forEach(dateKey => {
    const dObj = new Date(dateKey + 'T00:00:00');
    const dayOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const dateTitle = dObj.toLocaleDateString('en-US', dayOptions).toUpperCase();
    const tasksForDate = groups.upcoming[dateKey];

    html += `
      <div class="task-section-group">
        <div class="task-section-header">${dateTitle} (${tasksForDate.length})</div>
        ${tasksForDate.map(renderTaskRow).join('')}
      </div>
    `;
  });

  // 5. No Date Section
  if (groups.noDate.length > 0) {
    html += `
      <div class="task-section-group">
        <div class="task-section-header">Other Tasks (${groups.noDate.length})</div>
        ${groups.noDate.map(renderTaskRow).join('')}
      </div>
    `;
  }

  // Bottom Footer link to 1-Year History
  if (completedTasks.length > 0) {
    html += `
      <div class="tasks-completed-footer" onclick="setWidgetDisplayMode('history')">
        ✓ ${completedTasks.length} Completed in History →
      </div>
    `;
  }

  container.innerHTML = html;
}

// 4. VIEW 4: 1-YEAR COMPLETED HISTORY ARCHIVE
function renderHistoryView() {
  const container = document.getElementById('historyListContainer');
  const statsBadge = document.getElementById('historyStatsBadge');
  const searchInput = document.getElementById('historySearchInput');
  if (!container) return;

  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();

  let completed = State.tasks.filter(t => t.completed);

  // Filter by active member if member selected
  if (State.filterEmployeeId) {
    completed = completed.filter(t => t.employeeId === State.filterEmployeeId);
  }

  if (statsBadge) {
    statsBadge.textContent = `${completed.length} Completed (1-Yr Archive)`;
  }

  if (searchQuery) {
    completed = completed.filter(t => {
      const emp = State.employees.find(e => e.id === t.employeeId);
      const empName = emp ? emp.name.toLowerCase() : '';
      const client = (t.client || '').toLowerCase();
      const title = (t.title || '').toLowerCase();
      return title.includes(searchQuery) || empName.includes(searchQuery) || client.includes(searchQuery);
    });
  }

  if (completed.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 20px; font-size:12px; color:var(--text-tertiary);">
        ${searchQuery ? 'No matching completed tasks' : 'No completed tasks yet in 1-Year history'}
      </div>
    `;
    return;
  }

  // Sort by completedAt or createdAt descending (most recent first)
  completed.sort((a, b) => {
    const tA = new Date(a.completedAt || a.updatedAt || a.createdAt || 0).getTime();
    const tB = new Date(b.completedAt || b.updatedAt || b.createdAt || 0).getTime();
    return tB - tA;
  });

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yestStr = yesterday.toISOString().split('T')[0];

  const groups = {
    today: [],
    yesterday: [],
    earlier: {}
  };

  completed.forEach(task => {
    const cDate = (task.completedAt || task.updatedAt || task.createdAt || '').split('T')[0];
    if (cDate === todayStr) {
      groups.today.push(task);
    } else if (cDate === yestStr) {
      groups.yesterday.push(task);
    } else {
      const monthYear = cDate ? cDate.slice(0, 7) : 'Older';
      if (!groups.earlier[monthYear]) groups.earlier[monthYear] = [];
      groups.earlier[monthYear].push(task);
    }
  });

  let html = '';

  function renderHistoryRow(task) {
    const emp = State.employees.find(e => e.id === task.employeeId);
    const empName = emp ? emp.name : 'Unassigned';
    const empColor = emp ? (emp.avatarColor || '#0A84FF') : '#0A84FF';

    let dateText = '';
    if (task.completedAt) {
      const d = new Date(task.completedAt);
      dateText = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    return `
      <div class="history-item-row" id="hist-${task.id}">
        <input 
          type="checkbox" 
          class="history-checkbox" 
          checked 
          title="Click to Restore task"
          onchange="toggleTaskDone('${task.id}')"
        >
        <div class="history-content">
          <div class="history-title">${escapeHtml(task.title)}</div>
          <div class="history-meta">
            <span class="task-assignee-highlight" style="--emp-color:${empColor}">
              <span class="task-assignee-dot" style="background:${empColor};"></span>
              ${escapeHtml(empName)}
            </span>
            ${task.client ? `<span class="task-client-badge">${escapeHtml(task.client)}</span>` : ''}
            ${dateText ? `<span class="task-time-meta">${dateText}</span>` : ''}
          </div>
        </div>
        <button class="history-delete-btn" onclick="deleteTask('${task.id}', '${escapeHtml(task.title)}')" title="Delete from archive">✕</button>
      </div>
    `;
  }

  if (groups.today.length > 0) {
    html += `
      <div class="task-section-group">
        <div class="task-section-header today">Completed Today (${groups.today.length})</div>
        ${groups.today.map(renderHistoryRow).join('')}
      </div>
    `;
  }

  if (groups.yesterday.length > 0) {
    html += `
      <div class="task-section-group">
        <div class="task-section-header">Completed Yesterday (${groups.yesterday.length})</div>
        ${groups.yesterday.map(renderHistoryRow).join('')}
      </div>
    `;
  }

  Object.keys(groups.earlier).sort().reverse().forEach(myKey => {
    const tasksInMonth = groups.earlier[myKey];
    let monthTitle = myKey;
    if (myKey.includes('-')) {
      const [year, month] = myKey.split('-');
      const d = new Date(year, month - 1, 1);
      monthTitle = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
    }
    html += `
      <div class="task-section-group">
        <div class="task-section-header">${monthTitle} (${tasksInMonth.length})</div>
        ${tasksInMonth.map(renderHistoryRow).join('')}
      </div>
    `;
  });

  container.innerHTML = html;
}

function deleteTask(taskId, title) {
  if (confirm(`Permanently delete "${title}"?`)) {
    sendAction('DELETE_TASK', { id: taskId });
  }
}

function clearMemberFilter() {
  State.filterEmployeeId = null;
  renderTasksView();
}

// 2. Team View (Shows members; click member to filter their tasks)
function renderTeamView() {
  const container = document.getElementById('teamMembersList');
  if (!container) return;

  if (State.employees.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:30px; font-size:12px; color:var(--text-tertiary);">No Members Found</div>`;
    return;
  }

  let html = '';
  State.employees.forEach(emp => {
    const empTasks = State.tasks.filter(t => t.employeeId === emp.id);
    const pendingCount = empTasks.filter(t => !t.completed).length;
    const clientPills = (emp.todayClients || []).map(c => `<span class="member-client-tag">${escapeHtml(c)}</span>`).join('') || '';

    const initials = (emp.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    html += `
      <div class="team-member-card" onclick="filterByMember('${emp.id}')" title="View ${escapeHtml(emp.name)}'s tasks">
        <div class="member-info-left">
          <div class="member-avatar-circle">${initials}</div>
          <div style="min-width: 0;">
            <div style="display:flex; align-items:center; gap:5px;">
              <span class="member-name-text">${escapeHtml(emp.name)}</span>
              ${pendingCount > 0 ? `<span class="member-task-count-badge">${pendingCount}</span>` : ''}
            </div>
            <div class="member-role-sub">${escapeHtml(emp.role)}</div>
          </div>
        </div>
        <div class="member-right-meta">
          <div class="member-clients-pills">
            ${clientPills}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function filterByMember(empId) {
  State.filterEmployeeId = empId;
  setWidgetDisplayMode('tasks');
  if (window.appleSounds) window.appleSounds.playPop();
}

// 3. Timeline View (Real Live Events & Click to switch to task)
function renderTimelineView() {
  const now = new Date();
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayNameEl = document.getElementById('calTodayDayName');
  const dateNumEl = document.getElementById('calTodayDateNum');
  if (dayNameEl) dayNameEl.textContent = days[now.getDay()];
  if (dateNumEl) dateNumEl.textContent = now.getDate();

  const todaySlots = document.getElementById('calTodaySlots');
  const tomorrowSlots = document.getElementById('calTomorrowSlots');

  const todayStr = now.toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const hoursList = [
    { label: '9', h: 9 },
    { label: '10', h: 10 },
    { label: '11', h: 11 },
    { label: '12', h: 12 },
    { label: '1', h: 13 },
    { label: '2', h: 14 },
    { label: '3', h: 15 },
    { label: '4', h: 16 }
  ];

  const currentHour24 = now.getHours();
  const currentMinutes = now.getMinutes();

  let todayHtml = '';
  let scrubberAdded = false;

  hoursList.forEach(item => {
    const isCurrent = (currentHour24 === item.h);
    let scrubber = '';
    if (isCurrent && !scrubberAdded) {
      const topOffset = (currentMinutes / 60) * 100;
      scrubber = `<div class="cal-red-scrubber" style="top:${topOffset}%;"><div class="cal-red-dot"></div></div>`;
      scrubberAdded = true;
    }

    const tasksAtHour = State.tasks.filter(t => {
      if (t.dueDate !== todayStr && t.dueDate) return false;
      const h = parseInt((t.dueTime || '14:00').split(':')[0], 10);
      return h === item.h && !t.completed;
    });

    const schedsAtHour = State.schedules.filter(s => {
      if (s.date !== todayStr) return false;
      const h = parseInt((s.startTime || '14:00').split(':')[0], 10);
      return h === item.h;
    });

    let chips = [
      ...tasksAtHour.map(t => `<div class="cal-event-chip" onclick="goToTaskAndHighlight('${t.id}')">${escapeHtml(t.title)}</div>`),
      ...schedsAtHour.map(s => `<div class="cal-event-chip" style="border-left-color:var(--apple-green);" onclick="openEditScheduleModal('${s.id}')">${escapeHtml(s.title)}</div>`)
    ].join('');

    todayHtml += `
      <div class="cal-hour-row" onclick="quickAddAtHour('${todayStr}', '${item.h}:00')">
        ${scrubber}
        <div class="cal-hour-num">${item.label}</div>
        <div class="cal-hour-events">${chips}</div>
      </div>
    `;
  });

  if (todaySlots) todaySlots.innerHTML = todayHtml;

  // Tomorrow slots
  let tomorrowHtml = '';
  hoursList.forEach(item => {
    const tasksAtHour = State.tasks.filter(t => {
      if (t.dueDate !== tomorrowStr) return false;
      const h = parseInt((t.dueTime || '14:00').split(':')[0], 10);
      return h === item.h && !t.completed;
    });
    const schedsAtHour = State.schedules.filter(s => {
      if (s.date !== tomorrowStr) return false;
      const h = parseInt((s.startTime || '14:00').split(':')[0], 10);
      return h === item.h;
    });

    let chips = [
      ...tasksAtHour.map(t => `<div class="cal-event-chip" onclick="goToTaskAndHighlight('${t.id}')">${escapeHtml(t.title)}</div>`),
      ...schedsAtHour.map(s => `<div class="cal-event-chip" style="border-left-color:var(--apple-green);" onclick="openEditScheduleModal('${s.id}')">${escapeHtml(s.title)}</div>`)
    ].join('');

    tomorrowHtml += `
      <div class="cal-hour-row" onclick="quickAddAtHour('${tomorrowStr}', '${item.h}:00')">
        <div class="cal-hour-num">${item.label}</div>
        <div class="cal-hour-events">${chips}</div>
      </div>
    `;
  });

  if (tomorrowSlots) tomorrowSlots.innerHTML = tomorrowHtml;
}

function goToTaskAndHighlight(taskId) {
  setWidgetDisplayMode('tasks');
  setTimeout(() => {
    const el = document.getElementById(`item-${taskId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.background = 'rgba(255, 255, 255, 0.1)';
      setTimeout(() => { el.style.background = ''; }, 1200);
    }
  }, 100);
}

function quickAddAtHour(dateStr, timeStr) {
  openAddTaskModal();
  document.getElementById('taskDueDateInput').value = dateStr;
  document.getElementById('taskTimeSelect').value = timeStr.padStart(5, '0');
}

function renderSettingsData() {
  const empList = document.getElementById('settingsEmpList');
  if (empList) {
    empList.innerHTML = State.employees.map(emp => `
      <div class="settings-member-item">
        <div>
          <div class="settings-member-name">${escapeHtml(emp.name)}</div>
          <div class="settings-member-role">${escapeHtml(emp.role)}</div>
        </div>
        <button class="settings-del-btn" onclick="deleteEmployee('${emp.id}', '${escapeHtml(emp.name)}')" title="Remove">✕</button>
      </div>
    `).join('');
  }

  fetchNetworkInfo();
}

function renderDropdowns() {
  const select = document.getElementById('taskEmployeeSelect');
  if (select) {
    select.innerHTML = State.employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
  }
}

// Quick Date Pill Selector in Modal
function selectQuickDate(type) {
  const now = new Date();
  const dateInput = document.getElementById('taskDueDateInput');
  const labelMeta = document.getElementById('taskDateDisplayLabel');
  const customContainer = document.getElementById('customDateContainer');

  document.getElementById('btnDateToday')?.classList.toggle('active', type === 'today');
  document.getElementById('btnDateTomorrow')?.classList.toggle('active', type === 'tomorrow');
  document.getElementById('btnDateCustom')?.classList.toggle('active', type === 'custom');

  if (type === 'today') {
    const todayStr = now.toISOString().split('T')[0];
    if (dateInput) dateInput.value = todayStr;
    if (customContainer) customContainer.style.display = 'none';
    const dayName = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (labelMeta) labelMeta.textContent = `Today (${dayName})`;
  } else if (type === 'tomorrow') {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const tomStr = tom.toISOString().split('T')[0];
    if (dateInput) dateInput.value = tomStr;
    if (customContainer) customContainer.style.display = 'none';
    const dayName = tom.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (labelMeta) labelMeta.textContent = `Tomorrow (${dayName})`;
  } else {
    if (customContainer) customContainer.style.display = 'block';
    if (dateInput && !dateInput.value) {
      dateInput.value = now.toISOString().split('T')[0];
    }
    if (dateInput) {
      updateCustomDateLabel(dateInput.value);
      dateInput.onchange = () => updateCustomDateLabel(dateInput.value);
    }
  }
}

function updateCustomDateLabel(dateVal) {
  const labelMeta = document.getElementById('taskDateDisplayLabel');
  if (!dateVal) return;
  const d = new Date(dateVal + 'T00:00:00');
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (labelMeta) labelMeta.textContent = dayName;
}

// Modal Actions
function openAddTaskModal() {
  document.getElementById('taskForm').reset();
  document.getElementById('taskIdInput').value = '';
  document.getElementById('taskModalHeaderTitle').textContent = 'New Task';
  document.getElementById('taskModalSaveBtn').textContent = 'Add Task';
  selectQuickDate('today');
  openModal('taskModal');
}

function openEditTaskModal(taskId) {
  const task = State.tasks.find(t => t.id === taskId);
  if (!task) return;
  document.getElementById('taskIdInput').value = task.id;
  document.getElementById('taskModalHeaderTitle').textContent = 'Edit Task';
  document.getElementById('taskModalSaveBtn').textContent = 'Save Changes';
  document.getElementById('taskTitleInput').value = task.title;
  document.getElementById('taskEmployeeSelect').value = task.employeeId;
  document.getElementById('taskClientInput').value = task.client || '';
  
  const todayStr = new Date().toISOString().split('T')[0];
  const tomStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  if (!task.dueDate || task.dueDate === todayStr) {
    selectQuickDate('today');
  } else if (task.dueDate === tomStr) {
    selectQuickDate('tomorrow');
  } else {
    selectQuickDate('custom');
    const dateInput = document.getElementById('taskDueDateInput');
    if (dateInput) {
      dateInput.value = task.dueDate;
      updateCustomDateLabel(task.dueDate);
    }
  }

  document.getElementById('taskTimeSelect').value = task.dueTime || '14:00';
  openModal('taskModal');
}

function handleTaskSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('taskIdInput').value;
  const payload = {
    title: document.getElementById('taskTitleInput').value.trim(),
    employeeId: document.getElementById('taskEmployeeSelect').value,
    client: document.getElementById('taskClientInput').value.trim(),
    dueDate: document.getElementById('taskDueDateInput').value || new Date().toISOString().split('T')[0],
    dueTime: document.getElementById('taskTimeSelect').value || '14:00'
  };

  if (id) {
    sendAction('UPDATE_TASK', { id, ...payload });
  } else {
    sendAction('ADD_TASK', payload);
  }
  closeModal('taskModal');
}

function toggleTaskDone(taskId) {
  const task = State.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.completed = !task.completed;
  if (task.completed && window.appleSounds) {
    window.appleSounds.playComplete();
  }

  renderWidget();
  sendAction('TOGGLE_TASK_STATUS', { id: taskId });
}

function openAddEmployeeModal() {
  document.getElementById('employeeForm').reset();
  openModal('employeeModal');
}

function handleEmployeeSubmit(e) {
  e.preventDefault();
  const rawClients = document.getElementById('empClientsInput').value;
  const clients = rawClients.split(',').map(c => c.trim()).filter(c => c.length > 0);
  const payload = {
    name: document.getElementById('empNameInput').value.trim(),
    role: document.getElementById('empRoleInput').value.trim(),
    todayClients: clients
  };
  sendAction('ADD_EMPLOYEE', payload);
  closeModal('employeeModal');
}

function deleteEmployee(id, name) {
  if (confirm(`Remove ${name}?`)) {
    sendAction('DELETE_EMPLOYEE', { id });
  }
}

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function fetchNetworkInfo() {
  try {
    const res = await fetch('/api/network-info');
    const data = await res.json();
    const el = document.getElementById('settingsLanUrls');
    if (el && data.networkAddresses) {
      el.innerHTML = data.networkAddresses.map(a => `<div>${a.url}</div>`).join('');
    }
  } catch (e) {}
}

window.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  setInterval(renderTimelineView, 60000);
});
