import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send, MessageSquare, User as UserIcon, Circle, CheckCheck,
  Search, Plus, ShieldCheck, UserCheck, AlertCircle, RefreshCw
} from 'lucide-react';
import { chatApi, tokenStorage, User } from '@/services/api';
import { PageTitle, EmptyState, LoadingState, ErrorState, Modal } from '@/components/common/UIComponents';

export function ChatPage({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [liveMessages, setLiveMessages] = useState<any[]>([]);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Fetch conversations with search filter
  const { data: conversations = [], isLoading: convsLoading, refetch: refetchConvs } = useQuery({
    queryKey: ['conversations', searchQuery],
    queryFn: () => chatApi.getConversations(searchQuery),
    refetchInterval: 8000
  });

  // Fetch contacts for starting new chats
  const { data: contactsData } = useQuery({
    queryKey: ['chat_contacts'],
    queryFn: chatApi.getContacts,
    enabled: newChatModalOpen
  });

  // Select first conversation automatically if none selected
  useEffect(() => {
    if (conversations.length > 0 && !selectedConvId) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations, selectedConvId]);

  // Fetch messages for selected conversation
  const { data: initialMessages = [] } = useQuery({
    queryKey: ['messages', selectedConvId],
    queryFn: () => (selectedConvId ? chatApi.getMessages(selectedConvId) : Promise.resolve([])),
    enabled: !!selectedConvId
  });

  // Sync initial messages into live messages
  useEffect(() => {
    setLiveMessages(initialMessages);
  }, [initialMessages]);

  // Establish WebSocket connection when a conversation is selected
  useEffect(() => {
    if (!selectedConvId) return;

    const token = tokenStorage.getAccessToken();
    let wsBase = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
    const customApi = (import.meta as any).env?.VITE_API_URL;
    if (customApi) {
      try {
        const u = new URL(customApi, window.location.href);
        const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBase = `${proto}//${u.host}`;
      } catch (e) {
        // fallback to window.location.host
      }
    }
    const wsUrl = `${wsBase}/api/v1/chat/ws/${selectedConvId}?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLiveMessages((prev) => {
          // Deduplicate if already present
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [selectedConvId]);

  // Auto scroll to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveMessages]);

  const sendMutation = useMutation({
    mutationFn: ({ convId, text }: { convId: string; text: string }) =>
      chatApi.sendMessage(convId, text),
    onSuccess: (newMsg) => {
      setInputMessage('');
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  });

  const createChatMutation = useMutation({
    mutationFn: (data: any) => chatApi.createConversation(data),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setSelectedConvId(newConv.id);
      setNewChatModalOpen(false);
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedConvId) return;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(inputMessage.trim());
      setInputMessage('');
    } else {
      sendMutation.mutate({ convId: selectedConvId, text: inputMessage.trim() });
    }
  };

  const activeConv = conversations.find((c: any) => c.id === selectedConvId);

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#e5ebe5] pb-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#285d4b]">
            DIRECT MESSAGING
          </span>
          <h1 className="display text-2xl font-extrabold text-[#20342c]">
            Messages & Real-Time Chat
          </h1>
          <p className="text-xs text-[#6e7e76] mt-0.5">
            {user.role === 'admin'
              ? 'Admin inspection, conversation monitoring, and direct participant messaging.'
              : user.role === 'employee'
              ? 'Communicate directly with your assigned students in real time.'
              : 'Direct communication with your assigned teacher or support administration.'}
          </p>
        </div>

        <button
          onClick={() => setNewChatModalOpen(true)}
          className="btn btn-primary text-xs py-2 px-4 flex items-center gap-1.5 shadow-xs"
        >
          <Plus size={14} /> New Conversation
        </button>
      </div>

      <div className="panel overflow-hidden bg-white border border-[#e1e8e1] rounded-2xl grid grid-cols-1 md:grid-cols-3 h-[640px]">
        {/* Left Column: Search & Conversations */}
        <div className="border-r border-[#edf0ea] flex flex-col h-full bg-[#fafbf9]">
          <div className="p-3 border-b border-[#edf0ea] space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[#87978f]" />
              <input
                type="text"
                placeholder="Search conversations…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="field text-xs pl-8 py-1.5 bg-white"
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#718279] px-1 font-medium">
              <span>{conversations.length} Active Dialogues</span>
              <button
                onClick={() => refetchConvs()}
                className="hover:text-[#285d4b] flex items-center gap-1"
              >
                <RefreshCw size={11} /> Refresh
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#edf0ea]">
            {convsLoading ? (
              <div className="p-4 space-y-3">
                <div className="h-10 bg-[#e8ece7] rounded-xl animate-pulse" />
                <div className="h-10 bg-[#e8ece7] rounded-xl animate-pulse" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#7c8b84]">
                No conversations found. Click "New Conversation" to begin messaging.
              </div>
            ) : (
              conversations.map((c: any) => {
                let displayName = '';
                if (user.role === 'student') {
                  displayName = c.employee_name || 'Assigned Instructor';
                } else if (user.role === 'employee') {
                  displayName = c.student_name || 'Student';
                } else {
                  displayName = `${c.student_name} ↔ ${c.employee_name}`;
                }

                const isSelected = c.id === selectedConvId;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConvId(c.id)}
                    className={`w-full text-left p-3.5 transition flex items-start gap-3 ${
                      isSelected ? 'bg-white border-l-4 border-[#285d4b] shadow-xs' : 'hover:bg-[#f2f5f1]'
                    }`}
                  >
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e2ede4] text-xs font-bold text-[#2a5b47]">
                      {displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="font-bold text-[#23352e] flex items-center justify-between gap-1">
                        <span className="truncate">{displayName}</span>
                        {c.unread_count > 0 && (
                          <span className="rounded-full bg-[#bd483b] px-1.5 py-0.2 text-[9px] font-bold text-white shrink-0">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#718079] truncate mt-0.5">
                        {c.last_message || 'Start messaging…'}
                      </div>
                      {c.program_name && (
                        <div className="text-[9px] text-[#2c684e] font-semibold truncate mt-0.5">
                          {c.program_name}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation Stream */}
        <div className="md:col-span-2 flex flex-col h-full bg-white">
          {activeConv ? (
            <>
              {/* Header */}
              <div className="p-3.5 border-b border-[#edf0ea] bg-[#fafbf9] flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-[#243730]">
                    {user.role === 'student'
                      ? activeConv.employee_name
                      : user.role === 'employee'
                      ? activeConv.student_name
                      : `${activeConv.student_name} & ${activeConv.employee_name}`}
                  </div>
                  <div className="text-[10px] text-[#73837b] flex items-center gap-1.5 mt-0.5">
                    <Circle size={7} className="fill-[#3ea06b] text-[#3ea06b]" />
                    <span>WebSocket Real-Time Connected</span>
                    {activeConv.program_name && (
                      <span className="font-semibold text-[#285d4b]">· {activeConv.program_name}</span>
                    )}
                  </div>
                </div>

                {user.role === 'admin' && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-[#f0eaf7] text-[#63298e] px-2 py-0.5 rounded border border-[#dfcceb]">
                    Admin Inspection Mode (Audited)
                  </span>
                )}
              </div>

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fbfcfb]">
                {liveMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-xs text-[#7e8e87]">
                    <MessageSquare size={24} className="text-[#a4b4ac] mb-2" />
                    <span>No messages in this conversation yet. Send a greeting below!</span>
                  </div>
                ) : (
                  liveMessages.map((msg: any) => {
                    const isMe = msg.sender_id === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div className="text-[10px] text-[#798881] mb-0.5 px-1 font-medium">
                          {isMe ? 'You' : msg.sender_name}
                        </div>
                        <div
                          className={`max-w-md rounded-2xl px-4 py-2.5 text-xs leading-5 shadow-xs ${
                            isMe
                              ? 'bg-[#285d4b] text-white rounded-tr-none'
                              : 'bg-[#edf2ee] text-[#243730] rounded-tl-none'
                          }`}
                        >
                          {msg.message_text}
                        </div>
                        <div className="text-[9px] text-[#86968f] mt-0.5 px-1">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Message Input Box */}
              <form onSubmit={handleSend} className="p-3 border-t border-[#edf0ea] flex gap-2 bg-[#fafbf9]">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message…"
                  className="field text-xs flex-1 bg-white"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="btn btn-primary text-xs py-2 px-5 shrink-0 flex items-center gap-1 font-bold"
                >
                  <Send size={13} /> Send
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <EmptyState
                title="Select a Conversation"
                description="Choose an existing dialogue from the list or click 'New Conversation' to start messaging."
              />
            </div>
          )}
        </div>
      </div>

      {/* NEW CONVERSATION MODAL */}
      {newChatModalOpen && (
        <Modal
          title="Start a New Conversation"
          open={newChatModalOpen}
          onClose={() => setNewChatModalOpen(false)}
        >
          <div className="space-y-4">
            {/* Student Policy: Only chat with assigned supporting teacher */}
            {user.role === 'student' && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-[#1e293b]">
                  Your Assigned Supporting Teachers:
                </div>

                {(!contactsData?.assigned_teachers || contactsData.assigned_teachers.length === 0) ? (
                  <div className="p-4 text-center text-xs text-[#64748b] border border-dashed border-[#cbd5e1] rounded-xl">
                    No supporting teachers assigned to your active enrolled courses yet.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-xl">
                    {contactsData.assigned_teachers.map((teacher: any) => (
                      <div
                        key={teacher.id}
                        className="p-3 flex items-center justify-between hover:bg-[#f8fafc] transition"
                      >
                        <div>
                          <div className="text-xs font-bold text-[#0f172a]">{teacher.name}</div>
                          <div className="text-[11px] text-[#64748b]">
                            {teacher.email} {teacher.program_name && `· ${teacher.program_name}`}
                          </div>
                        </div>
                        <button
                          onClick={() => createChatMutation.mutate({
                            employeeId: teacher.id,
                            programId: teacher.program_id
                          })}
                          disabled={createChatMutation.isPending}
                          className="btn btn-primary text-xs py-1 px-3 font-bold"
                        >
                          Message Teacher
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Employee Policy: Chat with Admin and Assigned Students */}
            {user.role === 'employee' && (
              <div className="space-y-4">
                {/* Admin Contact Channel */}
                {contactsData?.admin_contact && (
                  <div className="p-3 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-extrabold text-[#166534]">
                        {contactsData.admin_contact.name}
                      </div>
                      <div className="text-[11px] text-[#15803d]">
                        Official platform administrative support & escalations.
                      </div>
                    </div>
                    <button
                      onClick={() => createChatMutation.mutate({ contactAdmin: true })}
                      disabled={createChatMutation.isPending}
                      className="btn btn-primary text-xs py-1.5 px-3 font-bold"
                    >
                      Chat with Admin
                    </button>
                  </div>
                )}

                {/* Assigned Students */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#1e293b]">
                    Your Assigned Students ({contactsData?.assigned_students?.length || 0}):
                  </div>

                  {(!contactsData?.assigned_students || contactsData.assigned_students.length === 0) ? (
                    <div className="p-4 text-center text-xs text-[#64748b] border border-dashed border-[#cbd5e1] rounded-xl">
                      No students are currently assigned to you.
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-xl">
                      {contactsData.assigned_students.map((student: any) => (
                        <div
                          key={student.id}
                          className="p-3 flex items-center justify-between hover:bg-[#f8fafc] transition"
                        >
                          <div>
                            <div className="text-xs font-bold text-[#0f172a]">{student.name}</div>
                            <div className="text-[11px] text-[#64748b]">
                              {student.email} {student.program_name && `· ${student.program_name}`}
                            </div>
                          </div>
                          <button
                            onClick={() => createChatMutation.mutate({
                              studentId: student.id,
                              programId: student.program_id
                            })}
                            disabled={createChatMutation.isPending}
                            className="btn btn-soft text-xs py-1 px-3 font-bold"
                          >
                            Chat
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Admin Policy: Chat with Registered Students AND Employees */}
            {user.role === 'admin' && (
              <div className="space-y-4">
                {/* Students List */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#1e293b] flex items-center justify-between">
                    <span>Registered Students ({contactsData?.students?.length || 0})</span>
                  </div>
                  {(!contactsData?.students || contactsData.students.length === 0) ? (
                    <div className="p-3 text-center text-xs text-[#64748b] border border-dashed rounded-lg">
                      No registered students found.
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-xl">
                      {contactsData.students.map((st: any) => (
                        <div key={st.id} className="p-2.5 flex items-center justify-between hover:bg-[#f8fafc]">
                          <div>
                            <span className="text-xs font-bold text-[#0f172a] block">{st.name}</span>
                            <span className="text-[10px] text-[#64748b]">{st.email}</span>
                          </div>
                          <button
                            onClick={() => createChatMutation.mutate({ studentId: st.id })}
                            disabled={createChatMutation.isPending}
                            className="btn btn-soft text-xs py-1 px-2.5 font-bold"
                          >
                            Chat
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Employees List */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#1e293b] flex items-center justify-between">
                    <span>Instructors & Employees ({contactsData?.employees?.length || 0})</span>
                  </div>
                  {(!contactsData?.employees || contactsData.employees.length === 0) ? (
                    <div className="p-3 text-center text-xs text-[#64748b] border border-dashed rounded-lg">
                      No employees found.
                    </div>
                  ) : (
                    <div className="max-h-40 overflow-y-auto divide-y divide-[#f1f5f9] border border-[#e2e8f0] rounded-xl">
                      {contactsData.employees.map((emp: any) => (
                        <div key={emp.id} className="p-2.5 flex items-center justify-between hover:bg-[#f8fafc]">
                          <div>
                            <span className="text-xs font-bold text-[#0f172a] block">{emp.name}</span>
                            <span className="text-[10px] text-[#64748b]">{emp.email}</span>
                          </div>
                          <button
                            onClick={() => createChatMutation.mutate({ employeeId: emp.id })}
                            disabled={createChatMutation.isPending}
                            className="btn btn-soft text-xs py-1 px-2.5 font-bold"
                          >
                            Chat
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

export default ChatPage;
