//  Native Apple Desktop Widget Engine (Cupertino HIG)

function getLocalISODate(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const STAGES = [
  { id: 'ordered', label: 'Ordered', shortLabel: 'Ordered', menuLabel: 'Ordered', sectionTitle: 'Ordered' },
  { id: 'work', label: 'Needs Work', shortLabel: 'Needs Work', menuLabel: 'Needs Work', sectionTitle: 'Needs Work' },
  { id: 'printing', label: 'Printing', shortLabel: 'Printing', menuLabel: 'In Printing', sectionTitle: 'In Printing' },
  { id: 'delivered', label: 'Delivered', shortLabel: 'Delivered', menuLabel: 'Delivered', sectionTitle: 'Delivered' }
];

const STAGE_MAP = Object.fromEntries(STAGES.map(s => [s.id, s]));

const STAGE_ICONS = {
  ordered: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  work: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  printing: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>`,
  delivered: `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
};

function normalizeClientStage(rawStage, completed = false) {
  if (typeof rawStage === 'string') {
    const s = rawStage.trim().toLowerCase();
    if (s === 'ordered' || s === 'order') return 'ordered';
    if (s === 'work' || s === 'todo' || s === 'needs_work' || s === 'pending') return 'work';
    if (s === 'printing' || s === 'in_printing' || s === 'in_progress' || s === 'print') return 'printing';
    if (s === 'delivered' || s === 'done' || s === 'completed') return 'delivered';
  }
  return completed ? 'delivered' : 'work';
}

function normalizeClientTask(task) {
  if (!task || typeof task !== 'object') return task;
  const stage = normalizeClientStage(task.stage || task.status, !!task.completed);
  const notes = (task.notes !== undefined ? String(task.notes) : (task.description || '')).trim();
  return {
    ...task,
    stage,
    category: (task.category || '').trim(),
    quantity: task.quantity !== undefined && task.quantity !== null ? String(task.quantity).trim() : '',
    notes,
    description: notes,
    completed: stage === 'delivered'
  };
}

const State = {
  version: 1,
  employees: [],
  tasks: [],
  clients: [],
  schedules: [],
  displayMode: 'tasks', // 'tasks', 'team', 'timeline', 'history'
  filterEmployeeId: null,
  filterStage: null, // null (all active) | 'ordered' | 'work' | 'printing' | 'delivered'
  filterCategory: '',
  searchQuery: '',
  groupMode: localStorage.getItem('team_todo_group_mode') || 'stage', // 'stage' | 'date'
  socket: null,
  peerCount: 1,
  isConnected: false,
  popoverTaskId: null,
  activeStageTrigger: null,
  popoverKeyboardOpen: false,
  confirmAction: null
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
  const { type, data, task, employee, id, count } = msg;

  if (type === 'INITIAL_STATE' || type === 'FULL_SYNC') {
    if (data) {
      State.employees = data.employees || [];
      State.tasks = (data.tasks || []).map(normalizeClientTask);
      State.clients = data.clients || [];
      State.schedules = data.schedules || [];
      renderWidget();
    }
  } else if (type === 'PEER_COUNT_UPDATE') {
    State.peerCount = count || 1;
    updateSyncUI(State.isConnected ? 'connected' : 'disconnected');
  } else {
    if (type === 'TASK_ADDED' && task) {
      const normalized = normalizeClientTask(task);
      const exists = State.tasks.some(t => t.id === normalized.id);
      if (!exists) {
        State.tasks.unshift(normalized);
        if (window.appleSounds) window.appleSounds.playPop();
      }
    }
    if (type === 'TASK_UPDATED' && task) {
      const normalized = normalizeClientTask(task);
      const idx = State.tasks.findIndex(t => t.id === normalized.id);
      if (idx !== -1) {
        State.tasks[idx] = normalized;
      } else {
        State.tasks.unshift(normalized);
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
  const tabMap = {
    tasks: 'btnModeTasks',
    team: 'btnModeTeam',
    timeline: 'btnModeTimeline',
    history: 'btnModeHistory'
  };
  Object.entries(tabMap).forEach(([key, btnId]) => {
    const btn = document.getElementById(btnId);
    const active = mode === key;
    btn?.classList.toggle('active', active);
    btn?.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  document.getElementById('tasksView')?.classList.toggle('active', mode === 'tasks');
  document.getElementById('teamView')?.classList.toggle('active', mode === 'team');
  document.getElementById('timelineView')?.classList.toggle('active', mode === 'timeline');
  document.getElementById('historyView')?.classList.toggle('active', mode === 'history');

  renderWidget();
}

function renderWidget() {
  const activeCount = State.tasks.filter(t => t.stage !== 'delivered' && !t.completed).length;
  const deliveredCount = State.tasks.filter(t => t.stage === 'delivered' || t.completed).length;

  const countEl = document.getElementById('widgetMainCount');
  const labelEl = document.getElementById('widgetMainLabel');
  if (countEl) countEl.textContent = activeCount;
  if (labelEl) {
    labelEl.innerHTML = `<span>Active</span> • <span style="color:var(--text-tertiary);">${deliveredCount} Delivered</span>`;
  }

  if (State.displayMode === 'tasks') renderTasksView();
  if (State.displayMode === 'team') renderTeamView();
  if (State.displayMode === 'timeline') renderTimelineView();
  if (State.displayMode === 'history') renderHistoryView();

  renderSettingsData();
  renderDropdowns();
}

function toggleStageFilter(stageId) {
  State.filterStage = State.filterStage === stageId ? null : stageId;
  if (window.appleSounds) window.appleSounds.playClick();
  renderTasksView();
}

function handleTasksSearchInput() {
  const input = document.getElementById('tasksSearchInput');
  const clearBtn = document.getElementById('tasksSearchClear');
  State.searchQuery = input ? input.value : '';
  if (clearBtn) clearBtn.style.display = State.searchQuery ? 'grid' : 'none';
  renderTasksView();
}

function clearTasksSearch() {
  const input = document.getElementById('tasksSearchInput');
  if (input) input.value = '';
  State.searchQuery = '';
  const clearBtn = document.getElementById('tasksSearchClear');
  if (clearBtn) clearBtn.style.display = 'none';
  renderTasksView();
}

function handleCategoryFilterChange() {
  const sel = document.getElementById('tasksCategoryFilter');
  State.filterCategory = sel ? sel.value : '';
  renderTasksView();
}

function toggleGroupMode() {
  State.groupMode = State.groupMode === 'stage' ? 'date' : 'stage';
  localStorage.setItem('team_todo_group_mode', State.groupMode);
  if (window.appleSounds) window.appleSounds.playClick();
  renderTasksView();
}

function taskMatchesSearch(task, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const emp = State.employees.find(e => e.id === task.employeeId);
  const empName = emp ? emp.name.toLowerCase() : '';
  const stageMeta = STAGE_MAP[task.stage] || STAGE_MAP.work;
  return (
    (task.title || '').toLowerCase().includes(q) ||
    (task.client || '').toLowerCase().includes(q) ||
    (task.category || '').toLowerCase().includes(q) ||
    (task.quantity || '').toLowerCase().includes(q) ||
    (task.notes || '').toLowerCase().includes(q) ||
    empName.includes(q) ||
    stageMeta.label.toLowerCase().includes(q)
  );
}

function updateStageSummaryUI(baseTasks) {
  const counts = { ordered: 0, work: 0, printing: 0, delivered: 0 };
  baseTasks.forEach(t => {
    const s = normalizeClientStage(t.stage || t.status, !!t.completed);
    counts[s] = (counts[s] || 0) + 1;
  });

  const elOrdered = document.getElementById('stageCountOrdered');
  const elWork = document.getElementById('stageCountWork');
  const elPrinting = document.getElementById('stageCountPrinting');
  const elDelivered = document.getElementById('stageCountDelivered');
  if (elOrdered) elOrdered.textContent = counts.ordered;
  if (elWork) elWork.textContent = counts.work;
  if (elPrinting) elPrinting.textContent = counts.printing;
  if (elDelivered) elDelivered.textContent = counts.delivered;

  document.querySelectorAll('#stageSummaryGrid .stage-tile').forEach(btn => {
    const stageId = btn.dataset.stage;
    const isPressed = State.filterStage === stageId;
    btn.setAttribute('aria-pressed', isPressed ? 'true' : 'false');
    btn.classList.toggle('active', isPressed);
  });

  const groupBtn = document.getElementById('btnGroupMode');
  if (groupBtn) {
    const isSingleStage = !!State.filterStage;
    groupBtn.disabled = isSingleStage;
    groupBtn.textContent = State.groupMode === 'stage' ? 'By Stage' : 'By Date';
    groupBtn.title = isSingleStage
      ? 'Clear stage tile filter to switch grouping'
      : 'Switch grouping between Stage and Date';
  }
}

function formatDueMeta(task) {
  const parts = [];
  if (task.dueDate) {
    const todayStr = getLocalISODate();
    if (task.dueDate === todayStr) {
      parts.push('Today');
    } else {
      const dObj = new Date(task.dueDate + 'T00:00:00');
      if (!Number.isNaN(dObj.getTime())) {
        parts.push(dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }
    }
  }
  if (task.dueTime) {
    const [hRaw, mRaw] = task.dueTime.split(':');
    let h = parseInt(hRaw, 10);
    const m = mRaw || '00';
    if (!Number.isNaN(h)) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      parts.push(`${h}:${m} ${ampm}`);
    }
  }
  return parts.join(' • ');
}

function renderTaskRow(task) {
  const emp = State.employees.find(e => e.id === task.employeeId);
  const empName = emp ? emp.name : 'Unassigned';
  const empColor = emp ? (emp.avatarColor || '#0A84FF') : '#0A84FF';
  const stage = normalizeClientStage(task.stage || task.status, !!task.completed);
  const stageMeta = STAGE_MAP[stage] || STAGE_MAP.work;
  const stageIcon = STAGE_ICONS[stage] || STAGE_ICONS.work;
  const isDelivered = stage === 'delivered';
  const dueText = formatDueMeta(task);

  return `
    <div class="reminder-item-row ${isDelivered ? 'is-delivered' : ''}" id="item-${task.id}">
      <input
        type="checkbox"
        class="apple-checkbox"
        ${isDelivered ? 'checked' : ''}
        title="${isDelivered ? 'Reopen as Needs Work' : 'Mark as Delivered'}"
        aria-label="${isDelivered ? 'Reopen' : 'Mark delivered'} ${escapeHtml(task.title)}"
        onchange="toggleTaskDone('${task.id}')"
      >
      <div class="reminder-content" onclick="openEditTaskModal('${task.id}')">
        <div class="reminder-title-row">
          <div class="reminder-title">${escapeHtml(task.title)}</div>
          ${task.quantity ? `<span class="task-qty-badge">${escapeHtml(task.quantity)}</span>` : ''}
        </div>
        <div class="reminder-meta-text">
          <button
            type="button"
            class="stage-badge stage-${stage}"
            aria-haspopup="menu"
            aria-expanded="false"
            onclick="openStageMenu(event, '${task.id}')"
            onkeydown="handleStageBadgeKeydown(event, '${task.id}')"
            title="Change stage"
          >
            ${stageIcon}
            <span>${stageMeta.shortLabel}</span>
            <span class="stage-caret" aria-hidden="true">▾</span>
          </button>
          ${task.category ? `<span class="task-type-badge">${escapeHtml(task.category)}</span>` : ''}
          <span class="task-assignee-highlight" style="--emp-color:${empColor}">
            ${escapeHtml(empName)}
          </span>
          ${task.client ? `<span class="task-client-badge">${escapeHtml(task.client)}</span>` : ''}
          ${dueText ? `<span class="task-time-meta">${escapeHtml(dueText)}</span>` : ''}
        </div>
        ${task.notes ? `<div class="reminder-notes-snippet">${escapeHtml(task.notes)}</div>` : ''}
      </div>
    </div>
  `;
}

// 1. Orders & Active Tasks View
function renderTasksView() {
  const container = document.getElementById('tasksListContainer');
  const banner = document.getElementById('activeMemberFilterBanner');
  const bannerText = document.getElementById('activeMemberFilterText');
  if (!container) return;

  let baseTasks = State.tasks;
  if (State.filterEmployeeId) {
    const filterEmp = State.employees.find(e => e.id === State.filterEmployeeId);
    baseTasks = baseTasks.filter(t => t.employeeId === State.filterEmployeeId);
    if (banner && bannerText && filterEmp) {
      banner.style.display = 'flex';
      bannerText.textContent = `${filterEmp.name}'s Orders`;
    }
  } else if (banner) {
    banner.style.display = 'none';
  }

  if (State.filterCategory) {
    baseTasks = baseTasks.filter(t => (t.category || '').toLowerCase() === State.filterCategory.toLowerCase());
  }

  if (State.searchQuery.trim()) {
    baseTasks = baseTasks.filter(t => taskMatchesSearch(t, State.searchQuery));
  }

  updateStageSummaryUI(baseTasks);

  // Filter by selected stage tile or default to all active (non-delivered)
  let visibleTasks;
  if (State.filterStage) {
    visibleTasks = baseTasks.filter(t => t.stage === State.filterStage);
    if (State.filterStage === 'delivered') {
      visibleTasks.sort((a, b) => {
        const tA = new Date(a.completedAt || a.updatedAt || a.createdAt || 0).getTime();
        const tB = new Date(b.completedAt || b.updatedAt || b.createdAt || 0).getTime();
        return tB - tA;
      });
    }
  } else {
    visibleTasks = baseTasks.filter(t => t.stage !== 'delivered' && !t.completed);
  }

  const totalDeliveredInBase = baseTasks.filter(t => t.stage === 'delivered' || t.completed).length;

  if (visibleTasks.length === 0) {
    const hasFilter = State.filterStage || State.filterCategory || State.searchQuery.trim() || State.filterEmployeeId;
    const emptyTitle = State.filterStage
      ? `No ${STAGE_MAP[State.filterStage]?.label || ''} items`
      : (hasFilter ? 'No matching orders found' : 'All Orders Delivered!');

    let emptyHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon">${hasFilter ? '○' : '✓'}</div>
        <div>${escapeHtml(emptyTitle)}</div>
        ${State.filterStage ? `<button type="button" class="clear-filter-btn" style="margin-top:6px;" onclick="toggleStageFilter('${State.filterStage}')">Show All Active</button>` : ''}
      </div>
    `;
    if (!State.filterStage && totalDeliveredInBase > 0) {
      emptyHtml += `
        <div class="tasks-completed-footer" onclick="toggleStageFilter('delivered')">
          ✓ ${totalDeliveredInBase} Delivered Orders →
        </div>
      `;
    }
    container.innerHTML = emptyHtml;
    return;
  }

  let html = '';

  if (State.filterStage) {
    const stageMeta = STAGE_MAP[State.filterStage];
    html += `
      <div class="task-section-group">
        <div class="task-section-header stage-hdr-${State.filterStage}">
          <span>${stageMeta.sectionTitle} (${visibleTasks.length})</span>
          <button type="button" class="clear-filter-btn" onclick="toggleStageFilter('${State.filterStage}')">All Active</button>
        </div>
        ${visibleTasks.map(renderTaskRow).join('')}
      </div>
    `;
  } else if (State.groupMode === 'stage') {
    const activeStages = ['ordered', 'work', 'printing'];
    activeStages.forEach(stageId => {
      const stageTasks = visibleTasks.filter(t => t.stage === stageId);
      if (stageTasks.length > 0) {
        const meta = STAGE_MAP[stageId];
        html += `
          <div class="task-section-group">
            <div class="task-section-header stage-hdr-${stageId}">${meta.sectionTitle} (${stageTasks.length})</div>
            ${stageTasks.map(renderTaskRow).join('')}
          </div>
        `;
      }
    });
  } else {
    // Date grouping
    const now = new Date();
    const todayStr = getLocalISODate(now);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = getLocalISODate(tomorrow);

    const groups = { overdue: [], today: [], tomorrow: [], upcoming: {}, noDate: [] };

    visibleTasks.forEach(task => {
      const d = task.dueDate;
      if (!d) groups.noDate.push(task);
      else if (d < todayStr) groups.overdue.push(task);
      else if (d === todayStr) groups.today.push(task);
      else if (d === tomorrowStr) groups.tomorrow.push(task);
      else {
        if (!groups.upcoming[d]) groups.upcoming[d] = [];
        groups.upcoming[d].push(task);
      }
    });

    if (groups.overdue.length > 0) {
      html += `
        <div class="task-section-group">
          <div class="task-section-header overdue">Overdue (${groups.overdue.length})</div>
          ${groups.overdue.map(renderTaskRow).join('')}
        </div>
      `;
    }
    if (groups.today.length > 0) {
      html += `
        <div class="task-section-group">
          <div class="task-section-header today">Today (${groups.today.length})</div>
          ${groups.today.map(renderTaskRow).join('')}
        </div>
      `;
    }
    if (groups.tomorrow.length > 0) {
      html += `
        <div class="task-section-group">
          <div class="task-section-header">Tomorrow (${groups.tomorrow.length})</div>
          ${groups.tomorrow.map(renderTaskRow).join('')}
        </div>
      `;
    }
    Object.keys(groups.upcoming).sort().forEach(dateKey => {
      const dObj = new Date(dateKey + 'T00:00:00');
      const dateTitle = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
      const tasksForDate = groups.upcoming[dateKey];
      html += `
        <div class="task-section-group">
          <div class="task-section-header">${dateTitle} (${tasksForDate.length})</div>
          ${tasksForDate.map(renderTaskRow).join('')}
        </div>
      `;
    });
    if (groups.noDate.length > 0) {
      html += `
        <div class="task-section-group">
          <div class="task-section-header">Other Orders (${groups.noDate.length})</div>
          ${groups.noDate.map(renderTaskRow).join('')}
        </div>
      `;
    }
  }

  if (!State.filterStage && totalDeliveredInBase > 0) {
    html += `
      <div class="tasks-completed-footer" onclick="toggleStageFilter('delivered')">
        ✓ ${totalDeliveredInBase} Delivered (Click to View) →
      </div>
    `;
  }

  container.innerHTML = html;
}

// ================= QUICK STAGE POPOVER MENU =================
function openStageMenu(event, taskId, fromKeyboard = false) {
  event.stopPropagation();
  const triggerBtn = event.currentTarget;
  const popover = document.getElementById('stagePopover');
  const task = State.tasks.find(t => t.id === taskId);
  if (!popover || !task) return;

  // Toggle closed if clicking the already-open trigger
  if (popover.matches(':popover-open')) {
    const sameTrigger = State.activeStageTrigger === triggerBtn;
    popover.hidePopover();
    if (sameTrigger) return;
  }

  State.popoverTaskId = taskId;
  State.activeStageTrigger = triggerBtn;
  State.popoverKeyboardOpen = fromKeyboard;

  const currentStage = normalizeClientStage(task.stage || task.status, !!task.completed);
  popover.querySelectorAll('.stage-menu-item').forEach(item => {
    const isSelected = item.dataset.stage === currentStage;
    item.setAttribute('aria-checked', isSelected ? 'true' : 'false');
  });

  const supportsImplicitAnchor = CSS.supports('position-area', 'block-end') && ('source' in ToggleEvent.prototype);
  if (supportsImplicitAnchor) {
    delete popover.dataset.fallbackPos;
    popover.style.left = '';
    popover.style.top = '';
  } else {
    popover.dataset.fallbackPos = 'true';
  }

  if (typeof popover.showPopover === 'function') {
    try {
      popover.showPopover({ source: triggerBtn });
    } catch (e) {
      popover.showPopover();
    }
  }

  if (!supportsImplicitAnchor) {
    positionPopoverFallback(popover, triggerBtn);
  }
}

function handleStageBadgeKeydown(event, taskId) {
  if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    event.stopPropagation();
    openStageMenu(event, taskId, true);
  }
}

function positionPopoverFallback(popover, trigger) {
  const rect = trigger.getBoundingClientRect();
  const menuRect = popover.getBoundingClientRect();
  const w = menuRect.width || 142;
  const h = menuRect.height || 136;

  let left = rect.left;
  if (left + w > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - w - 8);
  }
  let top = rect.bottom + 4;
  if (top + h > window.innerHeight - 8) {
    top = Math.max(8, rect.top - h - 4);
  }
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function selectStageFromPopover(stage) {
  const taskId = State.popoverTaskId;
  const popover = document.getElementById('stagePopover');
  if (popover && popover.matches(':popover-open')) {
    popover.hidePopover();
  }
  if (!taskId) return;

  const task = State.tasks.find(t => t.id === taskId);
  if (!task) return;

  const nextStage = normalizeClientStage(stage, false);
  if (task.stage !== nextStage) {
    task.stage = nextStage;
    task.completed = nextStage === 'delivered';
    task.completedAt = task.completed ? new Date().toISOString() : null;
    if (window.appleSounds) {
      if (nextStage === 'delivered') window.appleSounds.playComplete();
      else window.appleSounds.playPop();
    }
    renderWidget();
    sendAction('SET_TASK_STAGE', { id: taskId, stage: nextStage });
  }
}

function initStagePopoverEvents() {
  const popover = document.getElementById('stagePopover');
  if (!popover) return;

  popover.addEventListener('toggle', (event) => {
    const isOpen = event.newState === 'open';
    document.querySelectorAll('.stage-badge[aria-expanded="true"]').forEach(el => {
      if (!isOpen || el !== State.activeStageTrigger) {
        el.setAttribute('aria-expanded', 'false');
      }
    });

    const trigger = State.activeStageTrigger;
    if (isOpen && trigger) {
      trigger.setAttribute('aria-expanded', 'true');
      if (State.popoverKeyboardOpen) {
        const checked = popover.querySelector('[aria-checked="true"]') || popover.querySelector('.stage-menu-item');
        checked?.focus({ preventScroll: true });
        State.popoverKeyboardOpen = false;
      }
    } else if (!isOpen && !popover.matches(':popover-open')) {
      State.activeStageTrigger = null;
      State.popoverTaskId = null;
    }
  });

  // Fallback keyboard navigation if native focusgroup is unavailable
  if (!('focusGroup' in HTMLElement.prototype)) {
    const menu = popover.querySelector('[focusgroup~="menu"]');
    if (menu) {
      menu.setAttribute('role', 'menu');
      menu.addEventListener('keydown', (event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape'].includes(event.key)) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          const trigger = State.activeStageTrigger;
          popover.hidePopover();
          trigger?.focus();
          return;
        }
        const items = [...menu.querySelectorAll('button')].filter(b => !b.disabled);
        const current = items.indexOf(document.activeElement);
        if (current < 0 && items.length > 0) {
          event.preventDefault();
          items[0].focus({ preventScroll: true });
          return;
        }
        const next = event.key === 'Home' ? 0
          : event.key === 'End' ? items.length - 1
          : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
        event.preventDefault();
        items[next]?.focus({ preventScroll: true });
      }, true);
    }
  }
}

// 4. VIEW 4: 1-YEAR COMPLETED / DELIVERED HISTORY ARCHIVE
function renderHistoryView() {
  const container = document.getElementById('historyListContainer');
  const statsBadge = document.getElementById('historyStatsBadge');
  const searchInput = document.getElementById('historySearchInput');
  if (!container) return;

  const searchQuery = (searchInput ? searchInput.value : '').toLowerCase().trim();

  let completed = State.tasks.filter(t => t.stage === 'delivered' || t.completed);

  if (State.filterEmployeeId) {
    completed = completed.filter(t => t.employeeId === State.filterEmployeeId);
  }

  if (statsBadge) {
    statsBadge.textContent = `${completed.length} Delivered (1-Yr Archive)`;
  }

  if (searchQuery) {
    completed = completed.filter(t => taskMatchesSearch(t, searchQuery));
  }

  if (completed.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 20px; font-size:12px; color:var(--text-tertiary);">
        ${searchQuery ? 'No matching delivered orders' : 'No delivered orders yet in 1-Year history'}
      </div>
    `;
    return;
  }

  completed.sort((a, b) => {
    const tA = new Date(a.completedAt || a.updatedAt || a.createdAt || 0).getTime();
    const tB = new Date(b.completedAt || b.updatedAt || b.createdAt || 0).getTime();
    return tB - tA;
  });

  const now = new Date();
  const todayStr = getLocalISODate(now);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yestStr = getLocalISODate(yesterday);

  const groups = { today: [], yesterday: [], earlier: {} };

  completed.forEach(task => {
    const cDate = (task.completedAt || task.updatedAt || task.createdAt || '').split('T')[0];
    if (cDate === todayStr) groups.today.push(task);
    else if (cDate === yestStr) groups.yesterday.push(task);
    else {
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
          title="Click to restore to active orders"
          aria-label="Restore ${escapeHtml(task.title)}"
          onchange="toggleTaskDone('${task.id}')"
        >
        <div class="history-content" onclick="openEditTaskModal('${task.id}')" style="cursor:pointer;">
          <div class="reminder-title-row">
            <div class="history-title">${escapeHtml(task.title)}</div>
            ${task.quantity ? `<span class="task-qty-badge">${escapeHtml(task.quantity)}</span>` : ''}
          </div>
          <div class="history-meta">
            ${task.category ? `<span class="task-type-badge">${escapeHtml(task.category)}</span>` : ''}
            <span class="task-assignee-highlight" style="--emp-color:${empColor}">
              ${escapeHtml(empName)}
            </span>
            ${task.client ? `<span class="task-client-badge">${escapeHtml(task.client)}</span>` : ''}
            ${dateText ? `<span class="task-time-meta">${dateText}</span>` : ''}
          </div>
        </div>
        <button type="button" class="history-delete-btn" onclick="deleteTask('${task.id}')" title="Delete from archive" aria-label="Delete ${escapeHtml(task.title)}">✕</button>
      </div>
    `;
  }

  if (groups.today.length > 0) {
    html += `
      <div class="task-section-group">
        <div class="task-section-header today">Delivered Today (${groups.today.length})</div>
        ${groups.today.map(renderHistoryRow).join('')}
      </div>
    `;
  }
  if (groups.yesterday.length > 0) {
    html += `
      <div class="task-section-group">
        <div class="task-section-header">Delivered Yesterday (${groups.yesterday.length})</div>
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

function showConfirmDialog(title, message, okLabel, onConfirm) {
  const dialog = document.getElementById('confirmDialog');
  if (!dialog) return;
  document.getElementById('confirmDialogTitle').textContent = title;
  document.getElementById('confirmDialogMessage').textContent = message;
  document.getElementById('confirmDialogOkBtn').textContent = okLabel || 'Delete';
  State.confirmAction = onConfirm;
  dialog.returnValue = '';
  dialog.showModal();
}

function closeConfirmDialog(result) {
  const dialog = document.getElementById('confirmDialog');
  if (dialog && dialog.open) {
    dialog.close(result || 'cancel');
  }
}

function deleteTask(taskId) {
  const task = State.tasks.find(t => t.id === taskId);
  const label = task ? task.title : 'this order';
  showConfirmDialog('Delete Order', `Permanently delete "${label}"?`, 'Delete', () => {
    sendAction('DELETE_TASK', { id: taskId });
    closeModal('taskModal');
  });
}

function confirmDeleteCurrentTask() {
  const id = document.getElementById('taskIdInput')?.value;
  if (id) deleteTask(id);
}

function clearMemberFilter() {
  State.filterEmployeeId = null;
  renderTasksView();
}

// 2. Team View
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
    const pendingCount = empTasks.filter(t => t.stage !== 'delivered' && !t.completed).length;
    const clientPills = (emp.todayClients || []).map(c => `<span class="member-client-tag">${escapeHtml(c)}</span>`).join('') || '';
    const initials = (emp.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    html += `
      <div class="team-member-card" onclick="filterByMember('${emp.id}')" title="View ${escapeHtml(emp.name)}'s orders">
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

// 3. Timeline View
function renderTimelineView() {
  const now = new Date();
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayNameEl = document.getElementById('calTodayDayName');
  const dateNumEl = document.getElementById('calTodayDateNum');
  if (dayNameEl) dayNameEl.textContent = days[now.getDay()];
  if (dateNumEl) dateNumEl.textContent = now.getDate();

  const todaySlots = document.getElementById('calTodaySlots');
  const tomorrowSlots = document.getElementById('calTomorrowSlots');

  const todayStr = getLocalISODate(now);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalISODate(tomorrow);

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

    const chips = [
      ...tasksAtHour.map(t => `<div class="cal-event-chip stage-chip-${t.stage}" onclick="event.stopPropagation(); goToTaskAndHighlight('${t.id}')">${escapeHtml(t.title)}</div>`),
      ...schedsAtHour.map(s => `<div class="cal-event-chip" style="border-left-color:var(--apple-green);">${escapeHtml(s.title)}</div>`)
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

    const chips = [
      ...tasksAtHour.map(t => `<div class="cal-event-chip stage-chip-${t.stage}" onclick="event.stopPropagation(); goToTaskAndHighlight('${t.id}')">${escapeHtml(t.title)}</div>`),
      ...schedsAtHour.map(s => `<div class="cal-event-chip" style="border-left-color:var(--apple-green);">${escapeHtml(s.title)}</div>`)
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
  State.filterStage = null;
  setWidgetDisplayMode('tasks');
  setTimeout(() => {
    const el = document.getElementById(`item-${taskId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.background = 'rgba(255, 255, 255, 0.14)';
      setTimeout(() => { el.style.background = ''; }, 1200);
    }
  }, 100);
}

function quickAddAtHour(dateStr, timeStr) {
  openAddTaskModal();
  const todayStr = getLocalISODate();
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  const tomStr = getLocalISODate(tom);
  if (dateStr === todayStr) selectQuickDate('today');
  else if (dateStr === tomStr) selectQuickDate('tomorrow');
  else {
    selectQuickDate('custom');
    document.getElementById('taskDueDateInput').value = dateStr;
    updateCustomDateLabel(dateStr);
  }
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
        <button type="button" class="settings-del-btn" onclick="deleteEmployee('${emp.id}', '${escapeHtml(emp.name)}')" title="Remove" aria-label="Remove ${escapeHtml(emp.name)}">✕</button>
      </div>
    `).join('');
  }
  fetchNetworkInfo();
}

function renderDropdowns() {
  const select = document.getElementById('taskEmployeeSelect');
  if (select) {
    const prev = select.value;
    select.innerHTML = State.employees.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
    if (prev && State.employees.some(e => e.id === prev)) {
      select.value = prev;
    }
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
    const todayStr = getLocalISODate(now);
    if (dateInput) dateInput.value = todayStr;
    if (customContainer) customContainer.style.display = 'none';
    const dayName = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (labelMeta) labelMeta.textContent = `Today (${dayName})`;
  } else if (type === 'tomorrow') {
    const tom = new Date();
    tom.setDate(tom.getDate() + 1);
    const tomStr = getLocalISODate(tom);
    if (dateInput) dateInput.value = tomStr;
    if (customContainer) customContainer.style.display = 'none';
    const dayName = tom.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    if (labelMeta) labelMeta.textContent = `Tomorrow (${dayName})`;
  } else {
    if (customContainer) customContainer.style.display = 'block';
    if (dateInput && !dateInput.value) {
      dateInput.value = getLocalISODate(now);
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

// Modal Stage & Category Pickers
function selectModalStage(stage) {
  const normalized = normalizeClientStage(stage, false);
  const input = document.getElementById('taskStageInput');
  if (input) input.value = normalized;
  document.querySelectorAll('#taskStagePicker .stage-pick-btn').forEach(btn => {
    const active = btn.dataset.stage === normalized;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
}

function setModalCategory(category) {
  const clean = (category || '').trim();
  const input = document.getElementById('taskCategoryInput');
  if (input) input.value = clean;
  document.querySelectorAll('#taskCategoryPicker .category-chip').forEach(btn => {
    const active = btn.dataset.category.toLowerCase() === clean.toLowerCase() && clean !== '';
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function toggleModalCategory(category) {
  const current = (document.getElementById('taskCategoryInput')?.value || '').trim();
  if (current.toLowerCase() === category.toLowerCase()) {
    setModalCategory('');
  } else {
    setModalCategory(category);
  }
}

// Modal Actions
function openAddTaskModal() {
  document.getElementById('taskForm').reset();
  document.getElementById('taskIdInput').value = '';
  document.getElementById('taskModalHeaderTitle').textContent = 'New Order / Task';
  document.getElementById('taskModalSaveBtn').textContent = 'Add Order';
  const delBtn = document.getElementById('taskDeleteBtn');
  if (delBtn) delBtn.style.display = 'none';

  // Default stage to currently active filter stage (if ordered/work/printing), else ordered/work
  const defaultStage = (State.filterStage && State.filterStage !== 'delivered') ? State.filterStage : 'ordered';
  selectModalStage(defaultStage);
  setModalCategory(State.filterCategory || '');
  selectQuickDate('today');
  openModal('taskModal');
}

function openEditTaskModal(taskId) {
  const task = State.tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('taskIdInput').value = task.id;
  document.getElementById('taskModalHeaderTitle').textContent = 'Edit Order / Task';
  document.getElementById('taskModalSaveBtn').textContent = 'Save Changes';
  document.getElementById('taskTitleInput').value = task.title;
  document.getElementById('taskEmployeeSelect').value = task.employeeId;
  document.getElementById('taskClientInput').value = task.client || '';
  document.getElementById('taskQtyInput').value = task.quantity || '';
  document.getElementById('taskNotesInput').value = task.notes || task.description || '';

  const delBtn = document.getElementById('taskDeleteBtn');
  if (delBtn) delBtn.style.display = 'inline-flex';

  selectModalStage(normalizeClientStage(task.stage || task.status, !!task.completed));
  setModalCategory(task.category || '');

  const todayStr = getLocalISODate();
  const tom = new Date();
  tom.setDate(tom.getDate() + 1);
  const tomStr = getLocalISODate(tom);

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
  const titleEl = document.getElementById('taskTitleInput');
  if (titleEl) {
    titleEl.scrollLeft = 0;
    try { titleEl.setSelectionRange(0, 0); } catch (e) {}
  }
}

function handleTaskSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('taskIdInput').value;
  const stage = normalizeClientStage(document.getElementById('taskStageInput').value, false);
  const notes = document.getElementById('taskNotesInput').value.trim();
  const payload = {
    title: document.getElementById('taskTitleInput').value.trim(),
    stage,
    category: document.getElementById('taskCategoryInput').value.trim(),
    quantity: document.getElementById('taskQtyInput').value.trim(),
    notes,
    description: notes,
    employeeId: document.getElementById('taskEmployeeSelect').value,
    client: document.getElementById('taskClientInput').value.trim(),
    dueDate: document.getElementById('taskDueDateInput').value || getLocalISODate(),
    dueTime: document.getElementById('taskTimeSelect').value || '14:00'
  };

  if (id) {
    sendAction('UPDATE_TASK', { id, ...payload });
  } else {
    sendAction('ADD_TASK', payload);
  }
  if (window.appleSounds) {
    if (stage === 'delivered') window.appleSounds.playComplete();
    else window.appleSounds.playPop();
  }
  closeModal('taskModal');
}

function toggleTaskDone(taskId) {
  const task = State.tasks.find(t => t.id === taskId);
  if (!task) return;

  const nextCompleted = !task.completed;
  task.completed = nextCompleted;
  task.stage = nextCompleted ? 'delivered' : 'work';
  task.completedAt = nextCompleted ? new Date().toISOString() : null;

  if (nextCompleted && window.appleSounds) {
    window.appleSounds.playComplete();
  } else if (window.appleSounds) {
    window.appleSounds.playPop();
  }

  renderWidget();
  sendAction('TOGGLE_TASK_STATUS', { id: taskId, newStage: 'work' });
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
  showConfirmDialog('Remove Member', `Remove "${name}" from team?`, 'Remove', () => {
    sendAction('DELETE_EMPLOYEE', { id });
  });
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (id === 'settingsModal') {
    loadNotifyConfig();
  }
  if (typeof el.showModal === 'function') {
    if (!el.open) el.showModal();
  } else {
    el.classList.add('open');
  }
}

function switchSettingsTab(tab) {
  const isAlerts = tab === 'alerts';
  document.getElementById('btnSettingsGeneral')?.classList.toggle('active', !isAlerts);
  document.getElementById('btnSettingsAlerts')?.classList.toggle('active', isAlerts);
  document.getElementById('btnSettingsGeneral')?.setAttribute('aria-selected', isAlerts ? 'false' : 'true');
  document.getElementById('btnSettingsAlerts')?.setAttribute('aria-selected', isAlerts ? 'true' : 'false');

  const genEl = document.getElementById('settingsTabGeneral');
  const alertsEl = document.getElementById('settingsTabAlerts');
  if (genEl) genEl.style.display = isAlerts ? 'none' : 'flex';
  if (alertsEl) alertsEl.style.display = isAlerts ? 'flex' : 'none';
  if (isAlerts) loadNotifyConfig();
}

function setNotifyStatus(text, isError = false) {
  const el = document.getElementById('notifyStatusMsg');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('error', !!isError);
}

function updateWaProviderHint() {
  const sel = document.getElementById('notifyWaProviderSelect');
  const hint = document.getElementById('notifyWaHint');
  if (!sel || !hint) return;
  if (sel.value === 'callmebot') {
    hint.innerHTML = 'Text <code>I allow callmebot to send me messages</code> to CallMeBot active WhatsApp number to get your API key.';
  } else {
    hint.innerHTML = 'Get key at textmebot.com, add phone, then click <strong>Connect Number</strong> on TextMeBot.';
  }
}

function readNotifyFormPayload() {
  return {
    enabled: !!document.getElementById('notifyEnabledCheck')?.checked,
    scheduleTime: document.getElementById('notifyTimeInput')?.value || '09:00',
    scope: document.getElementById('notifyScopeSelect')?.value || 'keyring_and_active',
    emailEnabled: !!document.getElementById('notifyEmailEnabledCheck')?.checked,
    emailTo: document.getElementById('notifyEmailToInput')?.value.trim() || '',
    smtpUser: document.getElementById('notifySmtpUserInput')?.value.trim() || '',
    smtpPass: document.getElementById('notifySmtpPassInput')?.value.trim() || '',
    whatsappEnabled: !!document.getElementById('notifyWaEnabledCheck')?.checked,
    whatsappProvider: document.getElementById('notifyWaProviderSelect')?.value || 'textmebot',
    whatsappPhone: document.getElementById('notifyWaPhoneInput')?.value.trim() || '',
    whatsappApiKey: document.getElementById('notifyWaKeyInput')?.value.trim() || '',
    telegramEnabled: !!document.getElementById('notifyTgEnabledCheck')?.checked,
    telegramBotToken: document.getElementById('notifyTgTokenInput')?.value.trim() || '',
    telegramChatId: document.getElementById('notifyTgChatIdInput')?.value.trim() || '',
    webhookUrl: document.getElementById('notifyWebhookInput')?.value.trim() || ''
  };
}

async function loadNotifyConfig() {
  try {
    const res = await fetch('/api/notifications/config');
    if (!res.ok) {
      if (res.status === 403) {
        setNotifyStatus('Alerts can only be configured from the local host app.', true);
      }
      return;
    }
    const data = await res.json();
    const c = data.config;
    if (!c) return;

    document.getElementById('notifyEnabledCheck').checked = !!c.enabled;
    document.getElementById('notifyTimeInput').value = c.scheduleTime || '09:00';
    document.getElementById('notifyScopeSelect').value = c.scope || 'keyring_and_active';
    document.getElementById('notifyEmailEnabledCheck').checked = !!c.emailEnabled;
    document.getElementById('notifyEmailToInput').value = c.emailTo || '';
    document.getElementById('notifySmtpUserInput').value = c.smtpUser || '';

    const passInput = document.getElementById('notifySmtpPassInput');
    if (passInput) {
      passInput.value = '';
      passInput.placeholder = c.hasSmtpPass ? 'Saved (leave blank to keep)' : '16-char App Password';
    }

    document.getElementById('notifyWaEnabledCheck').checked = !!c.whatsappEnabled;
    const provSel = document.getElementById('notifyWaProviderSelect');
    if (provSel) provSel.value = c.whatsappProvider || 'textmebot';
    updateWaProviderHint();
    document.getElementById('notifyWaPhoneInput').value = c.whatsappPhone || '';

    const waKeyInput = document.getElementById('notifyWaKeyInput');
    if (waKeyInput) {
      waKeyInput.value = '';
      waKeyInput.placeholder = c.hasWhatsappApiKey ? 'Saved (leave blank to keep)' : 'API Key';
    }

    const tgCheck = document.getElementById('notifyTgEnabledCheck');
    if (tgCheck) tgCheck.checked = !!c.telegramEnabled;
    const tgToken = document.getElementById('notifyTgTokenInput');
    if (tgToken) {
      tgToken.value = '';
      tgToken.placeholder = c.hasTelegramBotToken ? 'Saved (leave blank to keep)' : '123456:ABC...';
    }
    const tgChat = document.getElementById('notifyTgChatIdInput');
    if (tgChat) tgChat.value = c.telegramChatId || '';

    document.getElementById('notifyWebhookInput').value = c.webhookUrl || '';
    if (c.lastSentDate) {
      setNotifyStatus(`Last auto-sent: ${c.lastSentDate}`);
    } else {
      setNotifyStatus('');
    }
  } catch (e) {}
}

async function shareSummaryToWhatsApp() {
  try {
    const scope = document.getElementById('notifyScopeSelect')?.value || 'keyring_and_active';
    const res = await fetch(`/api/notifications/preview?scope=${encodeURIComponent(scope)}`);
    const data = await res.json();
    const text = data?.digest?.text || '';
    if (!text) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  } catch (e) {}
}

async function saveNotifySettings(silent = false) {
  try {
    const payload = readNotifyFormPayload();
    const res = await fetch('/api/notifications/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      if (!silent) setNotifyStatus(data.error || 'Failed to save alert settings.', true);
      return false;
    }
    await loadNotifyConfig();
    if (!silent) {
      setNotifyStatus('✓ Alert settings saved.');
      if (window.appleSounds) window.appleSounds.playPop();
    }
    return true;
  } catch (e) {
    if (!silent) setNotifyStatus('Could not save settings.', true);
    return false;
  }
}

async function sendNotifyNow() {
  const btn = document.getElementById('btnSendNotifyNow');
  if (btn) btn.disabled = true;
  setNotifyStatus('Sending summary...');
  try {
    await saveNotifySettings(true);
    const res = await fetch('/api/notifications/send-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.success) {
      setNotifyStatus(`✓ Sent via ${data.sent.join(' & ')} (${data.counts?.keyringPending ?? 0} Keyring pending)`);
      if (window.appleSounds) window.appleSounds.playComplete();
    } else {
      const msg = (data.errors && data.errors[0]) || data.error || 'Send failed';
      const prefix = data.sent && data.sent.length ? `Sent via ${data.sent.join(', ')} • ` : '';
      setNotifyStatus(`${prefix}${msg}`, true);
    }
  } catch (e) {
    setNotifyStatus('Network error while sending.', true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof el.close === 'function') {
    if (el.open) el.close();
  } else {
    el.classList.remove('open');
  }
}

function initDialogEnhancements() {
  const confirmDialog = document.getElementById('confirmDialog');
  if (confirmDialog) {
    confirmDialog.addEventListener('close', () => {
      const val = confirmDialog.returnValue;
      confirmDialog.returnValue = '';
      const fn = State.confirmAction;
      State.confirmAction = null;
      if (val === 'confirm' && typeof fn === 'function') {
        fn();
      }
    });
  }

  // Light-dismiss fallback for browsers without native dialog closedby="any"
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dialog) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dialog of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, dialog); });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && outside(e, dialog)) dialog.close();
      });
    }
  }
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
      el.innerHTML = data.networkAddresses.map(a => `<div>${escapeHtml(a.url)}</div>`).join('');
    }
  } catch (e) {}
}

function setAppTheme(theme = 'apple') {
  const root = document.documentElement;
  if (theme === 'notion') {
    root.setAttribute('data-theme', 'notion');
    localStorage.setItem('team_todo_theme', 'notion');
    document.getElementById('btnThemeApple')?.classList.remove('active');
    document.getElementById('btnThemeNotion')?.classList.add('active');
  } else {
    root.setAttribute('data-theme', 'dark');
    localStorage.setItem('team_todo_theme', 'apple');
    document.getElementById('btnThemeApple')?.classList.add('active');
    document.getElementById('btnThemeNotion')?.classList.remove('active');
  }
}

function initAppTheme() {
  const saved = localStorage.getItem('team_todo_theme') || 'apple';
  setAppTheme(saved);
}

window.addEventListener('DOMContentLoaded', () => {
  initAppTheme();
  initDialogEnhancements();
  initStagePopoverEvents();
  initWebSocket();
  setInterval(renderTimelineView, 60000);
});
