// Complete API client connecting directly to FastAPI backend

const RAW_BASE = (import.meta as any).env?.VITE_API_URL || '';
const API_BASE = RAW_BASE ? `${RAW_BASE.replace(/\/$/, '')}/api/v1` : '/api/v1';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'employee' | 'student';
  status: 'active' | 'blocked' | 'inactive';
  identifier?: string;
  contact_number?: string;
  designation?: string;
  referral_code?: string;
  created_at: string;
}

export interface SessionData {
  access_token: string;
  refresh_token: string;
  user: User;
}

class ApiError extends Error {
  status: number;
  data: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

// Token management
export const tokenStorage = {
  getAccessToken: () => localStorage.getItem('access_token'),
  getRefreshToken: () => localStorage.getItem('refresh_token'),
  setTokens: (access: string, refresh: string) => {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  },
  clear: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_cache');
  }
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.getAccessToken();
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    // Try refreshing token
    const refreshToken = tokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        if (refreshRes.ok) {
          const newTokens = await refreshRes.json();
          tokenStorage.setTokens(newTokens.access_token, newTokens.refresh_token);
          headers['Authorization'] = `Bearer ${newTokens.access_token}`;
          const retryRes = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
          if (!retryRes.ok) {
            const err = await retryRes.json().catch(() => ({}));
            throw new ApiError(retryRes.status, err.detail || 'Request failed', err);
          }
          return retryRes.json();
        }
      } catch (e) {
        tokenStorage.clear();
        window.location.href = '/login';
      }
    }
    tokenStorage.clear();
    window.location.href = '/login';
    throw new ApiError(401, 'Session expired. Please log in again.');
  }

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorData.message || '';
    } catch {
      errorDetail = response.status === 404
        ? 'Backend API not reachable (404). Check Vercel function or VITE_API_URL.'
        : `Request failed (HTTP ${response.status}: ${response.statusText || 'Error'})`;
    }
    throw new ApiError(response.status, errorDetail || 'Request failed', {});
  }

  return response.json();
}

// Authentication
export const authApi = {
  login: async (email: string, password: string): Promise<SessionData> => {
    const res = await request<SessionData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    tokenStorage.setTokens(res.access_token, res.refresh_token);
    return res;
  },
  setupAdmin: async (data: { email: string; fullName: string; password: string }): Promise<SessionData> => {
    const res = await request<SessionData>('/auth/setup-admin', {
      method: 'POST',
      body: JSON.stringify({ email: data.email, full_name: data.fullName, password: data.password, role: 'admin' })
    });
    tokenStorage.setTokens(res.access_token, res.refresh_token);
    return res;
  },
  logout: async () => {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      tokenStorage.clear();
    }
  },
  me: async (): Promise<User> => {
    return request<User>('/auth/me');
  }
};

// Dashboard
export const dashboardApi = {
  getStats: () => request<any>('/dashboard'),
  getActivity: () => request<any[]>('/activity'),
};

// Students
export const studentsApi = {
  list: (search?: string, statusFilter?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (statusFilter) params.append('status_filter', statusFilter);
    const qs = params.toString();
    return request<any[]>(`/students${qs ? '?' + qs : ''}`);
  },
  create: (data: any) => request<any>('/students', {
    method: 'POST',
    body: JSON.stringify({
      email: data.email,
      full_name: data.fullName || data.full_name,
      password: data.password,
      role: 'student',
      identifier: data.identifier,
      contact_number: data.contactNumber || data.contact_number
    })
  }),
  get: (id: string) => request<any>(`/students/${id}`),
  update: (id: string, data: any) => request<any>(`/students/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  block: (id: string) => request<any>(`/students/${id}/block`, { method: 'POST' }),
  unblock: (id: string) => request<any>(`/students/${id}/unblock`, { method: 'POST' })
};

// Employees
export const employeesApi = {
  list: (search?: string, statusFilter?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (statusFilter) params.append('status_filter', statusFilter);
    const qs = params.toString();
    return request<any[]>(`/employees${qs ? '?' + qs : ''}`);
  },
  create: (data: any) => request<any>('/employees', {
    method: 'POST',
    body: JSON.stringify({
      email: data.email,
      full_name: data.fullName || data.full_name,
      password: data.password,
      role: 'employee',
      identifier: data.identifier,
      contact_number: data.contactNumber || data.contact_number,
      designation: data.designation
    })
  }),
  get: (id: string) => request<any>(`/employees/${id}`),
  update: (id: string, data: any) => request<any>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  block: (id: string) => request<any>(`/employees/${id}/block`, { method: 'POST' }),
  unblock: (id: string) => request<any>(`/employees/${id}/unblock`, { method: 'POST' })
};

// Teams
export const teamsApi = {
  list: () => request<any[]>('/teams'),
  create: (data: { name: string; description?: string }) => request<any>('/teams', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  update: (id: string, data: any) => request<any>(`/teams/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  assignMember: (teamId: string, employeeId: string) => request<any>(`/teams/${teamId}/members?employee_id=${employeeId}`, {
    method: 'POST'
  }),
  removeMember: (teamId: string, employeeId: string) => request<any>(`/teams/${teamId}/members/${employeeId}`, {
    method: 'DELETE'
  }),
  delete: (id: string) => request<any>(`/teams/${id}`, {
    method: 'DELETE'
  })
};

// Programs & Multi-Resource Curriculum Design
export const programsApi = {
  list: () => request<any[]>('/programs'),
  create: (data: any) => request<any>('/programs', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  get: (id: string) => request<any>(`/programs/${id}`),
  update: (id: string, data: any) => request<any>(`/programs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  addTrack: (programId: string, data: { name: string; description?: string; position?: number }) => request<any>(`/programs/${programId}/tracks`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateTrack: (trackId: string, data: any) => request<any>(`/tracks/${trackId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteTrack: (trackId: string) => request<any>(`/tracks/${trackId}`, {
    method: 'DELETE'
  }),
  addDay: (trackId: string, data: any) => request<any>(`/tracks/${trackId}/days`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getDay: (dayId: string) => request<any>(`/days/${dayId}`),
  updateDay: (dayId: string, data: any) => request<any>(`/days/${dayId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteDay: (dayId: string) => request<any>(`/days/${dayId}`, {
    method: 'DELETE'
  }),
  // Checklists
  getChecklist: (dayId: string) => request<any[]>(`/days/${dayId}/checklist`),
  addChecklistItem: (dayId: string, data: { title: string; description?: string; is_required?: boolean; display_order?: number }) => request<any>(`/days/${dayId}/checklist`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateChecklistItem: (itemId: string, data: any) => request<any>(`/checklist-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteChecklistItem: (itemId: string) => request<any>(`/checklist-items/${itemId}`, {
    method: 'DELETE'
  }),
  // Tasks
  addTask: (dayId: string, data: any) => request<any>(`/days/${dayId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  // Multi-Resources CRUD
  addResource: (dayId: string, data: { title: string; resource_type: string; url?: string; content?: string; display_order?: number; active?: boolean }) =>
    request<any>(`/days/${dayId}/resources`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateResource: (resourceId: string, data: any) => request<any>(`/resources/${resourceId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteResource: (resourceId: string) => request<any>(`/resources/${resourceId}`, {
    method: 'DELETE'
  }),
  // Flashcards CRUD
  addFlashcard: (dayId: string, data: { front_text: string; back_text: string; display_order?: number; active?: boolean }) =>
    request<any>(`/days/${dayId}/flashcards`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateFlashcard: (flashcardId: string, data: any) => request<any>(`/flashcards/${flashcardId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteFlashcard: (flashcardId: string) => request<any>(`/flashcards/${flashcardId}`, {
    method: 'DELETE'
  }),
  // Excel / CSV Curriculum Importer & Template
  importExcel: async (programId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<any>(`/programs/${programId}/import-excel`, {
      method: 'POST',
      body: formData
    });
  },
  getTemplateDownloadUrl: (programId: string) => `${API_BASE}/programs/${programId}/export-template`,
  downloadTemplate: async (programId: string, programName?: string) => {
    const token = tokenStorage.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/programs/${programId}/export-template`, { headers });
    if (!res.ok) throw new Error('Failed to download curriculum template');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${programName ? programName.replace(/\s+/g, '_') : 'Curriculum'}_Template.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};

// Enrollments & Day Unlocking Rules
export const enrollmentsApi = {
  list: () => request<any[]>('/enrollments'),
  create: (data: { student_id: string; program_id: string; employee_id?: string | null }) => request<any>('/enrollments', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  revoke: (id: string) => request<any>(`/enrollments/${id}/revoke`, { method: 'POST' }),
  assignEmployee: (enrollmentId: string, employeeId: string | null) => request<any>(`/enrollments/${enrollmentId}/assign-employee`, {
    method: 'POST',
    body: JSON.stringify({ employee_id: employeeId })
  }),
  unlockDay: (enrollmentId: string, dayId: string, reason?: string) => request<any>(`/enrollments/${enrollmentId}/days/${dayId}/unlock`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || 'Authorized unlock by instructor' })
  }),
  lockDay: (enrollmentId: string, dayId: string, reason?: string) => request<any>(`/enrollments/${enrollmentId}/days/${dayId}/lock`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || 'Administrative lock' })
  })
};

// Student Learning
export const studentApi = {
  getMyPrograms: () => request<any[]>('/student/programs'),
  getProgramProgress: (programId: string, studentId?: string) => 
    request<any[]>(`/student/programs/${programId}/progress${studentId ? `?student_id=${studentId}` : ''}`),
  getDayDetails: (dayId: string, studentId?: string) => 
    request<any>(`/student/days/${dayId}${studentId ? `?student_id=${studentId}` : ''}`),
  getAssignedStudents: (programId: string) => 
    request<any[]>(`/student/programs/${programId}/assigned-students`),
  updateActivityProgress: (dayId: string, activity: string, value: boolean) => request<any>(`/student/days/${dayId}/activity`, {
    method: 'POST',
    body: JSON.stringify({ activity, value })
  }),
  toggleChecklist: (itemId: string, completed: boolean) => request<any>(`/checklist-completions?item_id=${itemId}&completed=${completed}`, {
    method: 'POST'
  }),
  submitTask: (taskId: string, submissionText?: string, fileId?: string) => request<any>(`/tasks/${taskId}/submit`, {
    method: 'POST',
    body: JSON.stringify({ submission_text: submissionText, file_id: fileId })
  }),
  submitGoogleDrive: (dayId: string, googleDriveUrl: string, notes?: string) => request<any>('/submissions/google-drive', {
    method: 'POST',
    body: JSON.stringify({ day_id: dayId, google_drive_url: googleDriveUrl, notes })
  }),
  completeDay: (dayId: string) => request<any>(`/student/days/${dayId}/complete`, { method: 'POST' })
};

// Google Drive Submissions & Reviews
export const submissionsApi = {
  listGoogleDrive: (filters?: { status_filter?: string; program_id?: string; day_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status_filter) params.append('status_filter', filters.status_filter);
    if (filters?.program_id) params.append('program_id', filters.program_id);
    if (filters?.day_id) params.append('day_id', filters.day_id);
    const qs = params.toString();
    return request<any[]>(`/submissions/google-drive${qs ? '?' + qs : ''}`);
  },
  getGoogleDrive: (id: string) => request<any>(`/submissions/google-drive/${id}`),
  getStudentCourseDays: () => request<any[]>('/submissions/student-course-days'),
  reviewGoogleDrive: (id: string, data: { status?: string; review_comments?: string; rating?: number; improvement_suggestions?: string; additional_reward_points?: number }) =>
    request<any>(`/submissions/google-drive/${id}/review`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  // Legacy task submissions review
  listTaskSubmissions: (statusFilter?: string) => {
    const q = statusFilter ? `?status_filter=${statusFilter}` : '';
    return request<any[]>(`/submissions${q}`);
  },
  reviewTaskSubmission: (submissionId: string, status: string, feedback?: string) => request<any>(`/submissions/${submissionId}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, feedback })
  })
};

export const tasksApi = {
  listSubmissions: submissionsApi.listTaskSubmissions,
  reviewSubmission: submissionsApi.reviewTaskSubmission
};

// Student Referral Program
export const referralsApi = {
  getMyInfo: () => request<any>('/referrals/my-info'),
  getLeaderboard: () => request<any[]>('/referrals/leaderboard'),
  inviteFriend: (data: { referred_name: string; referred_email?: string; referred_phone?: string; referral_code?: string; funnel_stage?: string }) =>
    request<any>('/referrals/invite', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  claim: (code: string, guestName?: string, guestEmail?: string) => {
    const params = new URLSearchParams({ code });
    if (guestName) params.append('guest_name', guestName);
    if (guestEmail) params.append('guest_email', guestEmail);
    return request<any>(`/referrals/claim?${params.toString()}`, { method: 'POST' });
  },
  listCampaigns: () => request<any[]>('/referrals/campaigns'),
  logWhatsAppShare: (data?: { friend_name?: string; friend_phone?: string }) =>
    request<any>('/referrals/whatsapp-share', {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),
  awardPodiumBonus: () => request<any>('/referrals/award-podium-bonus', { method: 'POST' }),
  createCampaign: (data: any) => request<any>('/referrals/campaigns', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateCampaign: (id: string, data: any) => request<any>(`/referrals/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  listAll: (statusFilter?: string, roleFilter?: string) => {
    const params = new URLSearchParams();
    if (statusFilter) params.append('status_filter', statusFilter);
    if (roleFilter) params.append('role_filter', roleFilter);
    const qs = params.toString();
    return request<any[]>(`/referrals/all${qs ? '?' + qs : ''}`);
  },
  reviewReward: (recordId: string, data: { reward_status: string; reward_amount?: number }) =>
    request<any>(`/referrals/${recordId}/review`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  listUserLinks: (filters?: { role_filter?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.role_filter) params.append('role_filter', filters.role_filter);
    if (filters?.search) params.append('search', filters.search);
    const qs = params.toString();
    return request<any[]>(`/referrals/user-links${qs ? '?' + qs : ''}`);
  },
  assignUserLink: (userId: string, data: { referral_code?: string; referral_link?: string; approved?: boolean }) =>
    request<any>(`/referrals/user-links/${userId}/assign`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

// Reviews & Performance Spreadsheet
export const reviewsApi = {
  getOverview: (programId?: string) => {
    const q = programId ? `?program_id=${programId}` : '';
    return request<any>(`/reviews/overview${q}`);
  },
  getSpreadsheet: (filters?: { program_id?: string; student_id?: string; search?: string; status_filter?: string }) => {
    const params = new URLSearchParams();
    if (filters?.program_id) params.append('program_id', filters.program_id);
    if (filters?.student_id) params.append('student_id', filters.student_id);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status_filter) params.append('status_filter', filters.status_filter);
    const qs = params.toString();
    return request<any>(`/reviews/spreadsheet${qs ? '?' + qs : ''}`);
  },
  getExportCsvUrl: (filters?: { program_id?: string; student_id?: string; search?: string; status_filter?: string }) => {
    const params = new URLSearchParams();
    if (filters?.program_id) params.append('program_id', filters.program_id);
    if (filters?.student_id) params.append('student_id', filters.student_id);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status_filter) params.append('status_filter', filters.status_filter);
    const qs = params.toString();
    return `${API_BASE}/reviews/spreadsheet/export${qs ? '?' + qs : ''}`;
  }
};

// Reward Points
export const rewardsApi = {
  getWallet: () => request<any>('/rewards/wallet'),
  getConfig: () => request<any>('/rewards/config'),
  updateConfig: (data: any) => request<any>('/rewards/config', {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  adminAdjust: (data: { student_id: string; amount: number; reason: string; transaction_type?: string }) =>
    request<any>('/rewards/admin/adjust', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

// Razorpay Payments & Program Purchases
export const paymentsApi = {
  getConfig: () => request<any>('/payments/config'),
  listPrograms: () => request<any[]>('/payments/programs'),
  createOrder: (programId: string, pointsToRedeem: number = 0, referralCode?: string) =>
    request<any>('/payments/create-order', {
      method: 'POST',
      body: JSON.stringify({
        program_id: programId,
        points_to_redeem: pointsToRedeem,
        referral_code: referralCode
      })
    }),
  verifyPayment: (data: {
    purchase_id: string;
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  }) => request<any>('/payments/verify', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getHistory: () => request<any[]>('/payments/history'),
  listAllAdmin: () => request<any[]>('/payments/all'),
  getAdminRazorpayConfig: () => request<any>('/payments/admin/razorpay-config'),
  updateAdminRazorpayConfig: (data: {
    key_id: string;
    key_secret?: string;
    webhook_secret?: string;
    is_test_mode?: boolean;
    account_name?: string;
  }) => request<any>('/payments/admin/razorpay-config', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  testAdminRazorpayConnection: (data: { key_id: string; key_secret?: string }) =>
    request<any>('/payments/admin/test-connection', {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

// Files
export const filesApi = {
  upload: async (file: File): Promise<{ file_id: string; original_name: string; file_size: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    return request<any>('/files/upload', {
      method: 'POST',
      body: formData
    });
  },
  getDownloadUrl: (fileId: string) => `${API_BASE}/files/${fileId}/download`
};

// Chat
export const chatApi = {
  getConversations: (search?: string, programId?: string) => {
    const p = new URLSearchParams();
    if (search) p.append('search', search);
    if (programId) p.append('program_id', programId);
    const qs = p.toString();
    return request<any[]>(`/chat/conversations${qs ? '?' + qs : ''}`);
  },
  getContacts: () => request<any>('/chat/contacts'),
  createConversation: (data: { studentId?: string; employeeId?: string; programId?: string; contactAdmin?: boolean; title?: string }) => {
    const payload = {
      student_id: data.studentId,
      employee_id: data.employeeId,
      program_id: data.programId,
      contact_admin: !!data.contactAdmin,
      title: data.title
    };
    const p = new URLSearchParams();
    if (data.studentId) p.append('student_id', data.studentId);
    if (data.employeeId) p.append('employee_id', data.employeeId);
    if (data.programId) p.append('program_id', data.programId);
    if (data.contactAdmin) p.append('contact_admin', 'true');
    const qs = p.toString();
    return request<any>(`/chat/conversations${qs ? "?" + qs : ""}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getMessages: (conversationId: string) => request<any[]>(`/chat/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: string, messageText: string) => request<any>(`/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message_text: messageText })
  })
};

// Notifications & Audits
export const notificationsApi = {
  list: () => request<any[]>('/notifications'),
  markRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request<any>('/notifications/read-all', { method: 'POST' })
};

export const auditLogsApi = {
  list: (action?: string, targetType?: string) => {
    const p = new URLSearchParams();
    if (action) p.append('action', action);
    if (targetType) p.append('target_type', targetType);
    const qs = p.toString();
    return request<any[]>(`/audit-logs${qs ? '?' + qs : ''}`);
  }
};
